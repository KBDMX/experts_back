// emailService.js
import nodemailer from 'nodemailer';

// Configuración del transporter de nodemailer
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', // O tu servidor SMTP
  port: 587,
  secure: false,
  auth: {
    user: 'dthousandcuts@gmail.com',
    pass: 'zyze ocfe xkam gbsq'
  },
  tls: {
    rejectUnauthorized: false // Allow self-signed certificates
  }
});

// Plantilla del correo electrónico
const createEmailTemplate = (code: String) => {
  return {
    subject: 'Código de verificación',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
        <h1>ExpertGuide</h1>
        <h2>Tu código de verificación</h2>
        <p>Usa el siguiente código para verificar tu cuenta:</p>
        <div style="background-color: #f0f0f0; padding: 15px; margin: 20px 0; font-size: 24px; font-weight: bold;">
          ${code}
        </div>
        <p>Este código expirará en 10 minutos.</p>
        <p>Si no solicitaste este código, puedes ignorar este correo.</p>
      </div>
    `
  };
};

// Función para enviar el correo
export const sendAuthCode = async (email: string, code: string) => {
  try {
    const template = createEmailTemplate(code);

    const mailOptions = {
      from: '"ExpertGuide" <dthousandcuts@gmail.com>',
      to: email,
      subject: template.subject,
      html: template.html
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error al enviar el correo:', error);
    throw new Error('Error al enviar el código de verificación');
  }
};