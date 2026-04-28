import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { askAi } from "../services/openrouter.Service.js";
import User from "../models/user.model.js";
import Interview from "../models/interview.model.js";

const parseAiJson = (rawText) => {
    try {
        let cleaned = rawText
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");

        if (firstBrace !== -1 && lastBrace !== -1) {
            cleaned = cleaned.slice(firstBrace, lastBrace + 1);
        }

        cleaned = cleaned.replace(/,\s*]/g, "]");
        cleaned = cleaned.replace(/,\s*}/g, "}");

        const parsed = JSON.parse(cleaned);

        return {
            role: parsed.role || "",
            experience: parsed.experience || "",
            projects: Array.isArray(parsed.projects) ? parsed.projects : [],
            skills: Array.isArray(parsed.skills) ? parsed.skills : [],
            confidence: parsed.confidence || 0,
            communication: parsed.communication || 0,
            correctness: parsed.correctness || 0,
            finalScore: parsed.finalScore || 0,
            feedback: parsed.feedback || ""
        };
    } catch (error) {
        console.log("AI RAW RESPONSE:", rawText);

        return {
            role: "",
            experience: "",
            projects: [],
            skills: [],
            confidence: 0,
            communication: 0,
            correctness: 0,
            finalScore: 0,
            feedback: "Unable to evaluate properly."
        };
    }
};

export const analyzeResume = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Resume required" });
        }

        const filepath = req.file.path;
        const fileBuffer = await fs.promises.readFile(filepath);

        const pdf = await pdfjsLib.getDocument({
            data: new Uint8Array(fileBuffer)
        }).promise;

        let resumeText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(" ");
            resumeText += pageText + "\n";
        }

        resumeText = resumeText.replace(/\s+/g, " ").trim();

        const messages = [
            {
                role: "system",
                content: `
Extract resume information.

Return ONLY valid JSON:
{
  "role":"string",
  "experience":"string",
  "projects":["project1","project2"],
  "skills":["skill1","skill2"]
}
`
            },
            {
                role: "user",
                content: resumeText
            }
        ];

        const aiResponse = await askAi(messages);
        console.log("AI RAW:", aiResponse);

        const parsed = parseAiJson(aiResponse);

        fs.unlinkSync(filepath);

        return res.json({
            role: parsed.role,
            experience: parsed.experience,
            projects: parsed.projects,
            skills: parsed.skills,
            resumeText
        });
    } catch (error) {
        console.log(error);

        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        return res.status(500).json({
            message: error.message
        });
    }
};

export const generateQuestions = async (req, res) => {
    try {
        let { role, experience, mode, resumeText, projects, skills } = req.body;

        if (!role || !experience || !mode) {
            return res.status(400).json({
                message: "Role, Experience and Mode are required"
            });
        }

        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        if (user.credits < 50) {
            return res.status(400).json({
                message: "Minimum 50 credits required"
            });
        }

        const aiResponse = await askAi([
            {
                role: "system",
                content: "Generate exactly 5 interview questions. Return one question per line only."
            },
            {
                role: "user",
                content: `
Role: ${role}
Experience: ${experience}
Mode: ${mode}
Projects: ${(projects || []).join(", ")}
Skills: ${(skills || []).join(", ")}
Resume: ${resumeText || ""}
`
            }
        ]);

        const questionsArray = aiResponse
            .split("\n")
            .map(q => q.trim())
            .filter(Boolean)
            .slice(0, 5);

        user.credits -= 50;
        await user.save();

        const interview = await Interview.create({
            userId: user._id,
            role,
            experience,
            mode,
            resumeText,
            questions: questionsArray.map((q, i) => ({
                question: q,
                difficulty: ["easy", "easy", "medium", "medium", "hard"][i],
                timeLimit: [60, 60, 90, 90, 120][i]
            }))
        });

        return res.json({
            interviewId: interview._id,
            creditsLeft: user.credits,
            userName: user.name,
            questions: interview.questions
        });
    } catch (error) {
        return res.status(500).json({
            message: `Failed to generate interview: ${error.message}`
        });
    }
};

export const submitAnswer = async (req, res) => {
    try {
        const { interviewId, questionIndex, answer } = req.body;

        const interview = await Interview.findById(interviewId);

        if (!interview) {
            return res.status(404).json({
                message: "Interview not found"
            });
        }

        const question = interview.questions[questionIndex];

        if (!answer) {
            question.score = 0;
            question.feedback = "No answer submitted.";
            question.answer = "";
            await interview.save();

            return res.json({
                feedback: question.feedback
            });
        }

        const aiResponse = await askAi([
            {
                role: "system",
                content: `
Return ONLY valid JSON:
{
 "confidence": number,
 "communication": number,
 "correctness": number,
 "finalScore": number,
 "feedback": "string"
}
`
            },
            {
                role: "user",
                content: `Question: ${question.question}\nAnswer: ${answer}`
            }
        ]);

        const parsed = parseAiJson(aiResponse);

        question.answer = answer;
        question.confidence = parsed.confidence;
        question.communication = parsed.communication;
        question.correctness = parsed.correctness;
        question.score = parsed.finalScore;
        question.feedback = parsed.feedback;

        await interview.save();

        return res.json({
            feedback: question.feedback
        });
    } catch (error) {
        return res.status(500).json({
            message: `Failed to submit answer: ${error.message}`
        });
    }
};

export const finishInterview = async (req, res) => {
    try {
        const { interviewId } = req.body;
        const interview = await Interview.findById(interviewId);

        if (!interview) {
            return res.status(404).json({
                message: "Interview not found"
            });
        }

        const totalQuestions = interview.questions.length;

        const totalScore = interview.questions.reduce((sum, q) => sum + (q.score || 0), 0);
        const totalConfidence = interview.questions.reduce((sum, q) => sum + (q.confidence || 0), 0);
        const totalCommunication = interview.questions.reduce((sum, q) => sum + (q.communication || 0), 0);
        const totalCorrectness = interview.questions.reduce((sum, q) => sum + (q.correctness || 0), 0);

        interview.finalScore = totalScore / totalQuestions;
        interview.status = "completed";

        await interview.save();

        return res.json({
            finalScore: Number((totalScore / totalQuestions).toFixed(1)),
            confidence: Number((totalConfidence / totalQuestions).toFixed(1)),
            communication: Number((totalCommunication / totalQuestions).toFixed(1)),
            correctness: Number((totalCorrectness / totalQuestions).toFixed(1)),
            questionWiseScore: interview.questions
        });
    } catch (error) {
        return res.status(500).json({
            message: `Failed to finish interview: ${error.message}`
        });
    }
};

export const getMyInterviews = async (req, res) => {
    try {
        const interviews = await Interview.find({ userId: req.userId })
            .sort({ createdAt: -1 });

        return res.json(interviews);
    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};

export const getInterviewReport = async (req, res) => {
    try {
        const interview = await Interview.findById(req.params.id);

        if (!interview) {
            return res.status(404).json({
                message: "Interview not found"
            });
        }

        return res.json(interview);
    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};