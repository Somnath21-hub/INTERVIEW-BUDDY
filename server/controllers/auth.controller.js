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
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
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

export const logOut=async(req,res)=>{
    try {
      const isProduction = process.env.NODE_ENV === "production";
      res.clearCookie("token", {
          httpOnly: true,
          secure: isProduction,
          sameSite: isProduction ? "none" : "lax"
      });
      return res.status(200).json({message:"Logout Successfully"})
    } catch (error) {
         return res.status(500).json({
            message: `Logout error: ${error}`})
    }
}