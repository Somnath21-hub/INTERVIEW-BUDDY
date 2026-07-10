import User from "../models/user.model.js";
import genToken from "../config/token.js";

export const googleAuth = async (req, res) => {
    try {
        const { name, email } = req.body;

        let user = await User.findOne({ email });

        if (!user) {
            user = await User.create({
                name,
                email
            });
        }

        const token = genToken(user._id);

        const isProduction = process.env.NODE_ENV === "production";
        res.cookie("token", token, {
            httpOnly: true,
<<<<<<< HEAD
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
=======
            secure: true,
            sameSite: "None",   // ✅ FIXED (capital N)
>>>>>>> origin/main
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.status(200).json({
            message: "Google authentication successful",
            user
        });

    } catch (error) {
        return res.status(500).json({
            message: `Google auth error: ${error}`
        });
    }
};

export const logOut = async (req, res) => {
    try {
<<<<<<< HEAD
      const isProduction = process.env.NODE_ENV === "production";
      res.clearCookie("token", {
          httpOnly: true,
          secure: isProduction,
          sameSite: isProduction ? "none" : "lax"
      });
      return res.status(200).json({message:"Logout Successfully"})
=======
        await res.clearCookie("token", {
            httpOnly: true,
            secure: true,
            sameSite: "None"   // ✅ also fix here
        });

        return res.status(200).json({ message: "Logout Successfully" });
>>>>>>> origin/main
    } catch (error) {
        return res.status(500).json({
            message: `Logout error: ${error}`
        });
    }
};
