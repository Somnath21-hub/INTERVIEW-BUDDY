import fs from "fs"
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { askAi } from "../services/openrouter.Service.js"
import User from "../models/user.model.js"
import Interview from "../models/interview.model.js";

const parseAiJson = (rawText) => {
    let cleaned = rawText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    try {
        return JSON.parse(cleaned);
    } catch {
        try {
            let repaired = cleaned;

            if (!repaired.includes("]}")) {
                repaired = repaired.replace(/,\s*$/, "");
            }

            if (!repaired.endsWith("}")) {
                repaired += "}";
            }

            return JSON.parse(repaired);
        } catch {
            console.log("AI RESPONSE:", rawText);
            throw new Error("Invalid JSON returned from AI");
        }
    }
};

export const analyzeResume = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Resume required" });
        }

        const filepath = req.file.path;
        const fileBuffer = await fs.promises.readFile(filepath);
        const uint8Array = new Uint8Array(fileBuffer);
        const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;

        let resumeText = "";

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const content = await page.getTextContent();
            const pageText = content.items.map(item => item.str).join(" ");
            resumeText += pageText + "\n";
        }

        resumeText = resumeText.replace(/\s+/g, " ").trim();

        const messages = [
            {
                role: "system",
                content: `
Extracted data from resume.
Return strictly JSON:
{
    "role":"string",
    "experience":"string",
    "projects":["project1","project2"],
    "skills":["skill1","skill2"]
}`
            },
            {
                role: "user",
                content: resumeText
            }
        ];

        const aiResponse = await askAi(messages);
        const parsed = parseAiJson(aiResponse);

        fs.unlinkSync(filepath);

        res.json({
            role: parsed.role || "",
            experience: parsed.experience || "",
            projects: parsed.projects || [],
            skills: parsed.skills || [],
            resumeText
        });

    } catch (error) {
        console.error(error);

        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        return res.status(500).json({ message: error.message });
    }
};

export const generateQuestions = async (req, res) => {
    try {
        let { role, experience, mode, resumeText, projects, skills } = req.body;

        role = role?.trim();
        experience = experience?.trim();
        mode = mode?.trim();

        if (!role || !experience || !mode) {
            return res.status(400).json({ message: "Role,Experience and Mode are Required" });
        }

        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.credits < 50) {
            return res.status(400).json({ message: "Not enough credits.Minimum 50 Required" });
        }

        const projectText = Array.isArray(projects) && projects.length ? projects.join(",") : "None";
        const skillsText = Array.isArray(skills) && skills.length ? skills.join(",") : "None";
        const safeResume = resumeText?.trim() || "None";

        const messages = [
            {
                role: "system",
                content: `Generate exactly 5 interview questions, one per line.`
            },
            {
                role: "user",
                content: `
Role:${role}
Experience:${experience}
InterviewMode:${mode}
Projects:${projectText}
Skills:${skillsText}
Resume:${safeResume}`
            }
        ];

        const aiResponse = await askAi(messages);

        const questionsArray = aiResponse
            .split("\n")
            .map(q => q.trim())
            .filter(q => q.length > 0)
            .slice(0, 5);

        user.credits -= 50;
        await user.save();

        const interview = await Interview.create({
            userId: user._id,
            role,
            experience,
            mode,
            resumeText,
            questions: questionsArray.map((q, index) => ({
                question: q,
                difficulty: ["easy", "easy", "medium", "medium", "hard"][index],
                timeLimit: [60, 60, 90, 90, 120][index]
            }))
        });

        res.json({
            interviewId: interview._id,
            creditsLeft: user.credits,
            userName: user.name,
            questions: interview.questions
        });

    } catch (error) {
        return res.status(500).json({ message: `failed to create interview ${error}` });
    }
};

export const submitAnswer = async (req, res) => {
    try {
        const { interviewId, questionIndex, answer, timeTaken } = req.body;

        const interview = await Interview.findById(interviewId);

        if (!interview) {
            return res.status(404).json({ message: "Interview not found" });
        }

        const question = interview.questions[questionIndex];

        if (!answer) {
            question.score = 0;
            question.feedback = "You did not submit an answer.";
            question.answer = "";
            await interview.save();
            return res.json({ feedback: question.feedback });
        }

        const aiResponse = await askAi([
            {
                role: "system",
                content: `Return JSON with confidence, communication, correctness, finalScore and feedback`
            },
            {
                role: "user",
                content: `Question:${question.question}\nAnswer:${answer}`
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

        return res.status(200).json({ feedback: parsed.feedback });

    } catch (error) {
        return res.status(500).json({ message: `failed to submit answer ${error}` });
    }
};

export const finishInterview = async (req, res) => {
    try {
        const { interviewId } = req.body;
        const interview = await Interview.findById(interviewId);

        if (!interview) {
            return res.status(400).json({ message: "failed to find Interview" });
        }

        const totalQuestions = interview.questions.length;

        let totalScore = 0;
        let totalConfidence = 0;
        let totalCommunication = 0;
        let totalCorrectness = 0;

        interview.questions.forEach((q) => {
            totalScore += q.score || 0;
            totalConfidence += q.confidence || 0;
            totalCommunication += q.communication || 0;
            totalCorrectness += q.correctness || 0;
        });

        interview.finalScore = totalQuestions ? totalScore / totalQuestions : 0;
        interview.status = "completed";

        await interview.save();

        return res.status(200).json({
            finalScore: Number((totalScore / totalQuestions).toFixed(1)),
            confidence: Number((totalConfidence / totalQuestions).toFixed(1)),
            communication: Number((totalCommunication / totalQuestions).toFixed(1)),
            correctness: Number((totalCorrectness / totalQuestions).toFixed(1)),
            questionWiseScore: interview.questions
        });

    } catch (error) {
        return res.status(500).json({ message: `failed to finish Interview ${error}` });
    }
};

export const getMyInterviews = async (req, res) => {
    try {
        const interviews = await Interview.find({ userId: req.userId })
            .sort({ createdAt: -1 })
            .select("role experience mode finalScore status createdAt");

        return res.status(200).json(interviews);
    } catch (error) {
        return res.status(500).json({ message: `failed to find currentUser Interview ${error}` });
    }
};

export const getInterviewReport = async (req, res) => {
    try {
        const interview = await Interview.findById(req.params.id);

        if (!interview) {
            return res.status(404).json({ message: "Interview Not Found" });
        }

        const totalQuestions = interview.questions.length;

        let totalConfidence = 0;
        let totalCommunication = 0;
        let totalCorrectness = 0;

        interview.questions.forEach((q) => {
            totalConfidence += q.confidence || 0;
            totalCommunication += q.communication || 0;
            totalCorrectness += q.correctness || 0;
        });

        return res.json({
            finalScore: interview.finalScore,
            confidence: Number((totalConfidence / totalQuestions).toFixed(1)),
            communication: Number((totalCommunication / totalQuestions).toFixed(1)),
            correctness: Number((totalCorrectness / totalQuestions).toFixed(1)),
            questionWiseScore: interview.questions
        });

    } catch (error) {
        return res.status(500).json({ message: `failed to find currentUser Interview ${error}` });
    }
};