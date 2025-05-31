// import { Resend } from "resend";

// export async function sendEmail({ to, subject, react }) { 
//     const resend = new Resend(process.env.RESEND_API_KEY || "");
//     try {
//         const data = await resend.emails.send({
//             from: "Finance App <onboarding@resend.dev>",
//             to,
//             subject,
//             react,
//         });
//         return {success: true, data};
        
//     } catch (error) {
//         console.error("Failed to send email:", error);
//         return {success: false, error};
        
//     }
// }

// send-email.js
import nodemailer from "nodemailer";


export async function sendEmail({ to, subject, html }) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "sh.reyansh9026@gmail.com",
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const mailOptions = {
    from: "sh.reyansh9026@gmail.com",
    to,
    subject,
    html, // send pre-rendered HTML
  };

  return await transporter.sendMail(mailOptions);

}
