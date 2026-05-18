const nodemailer = require('nodemailer');
const logger = require('../config/logger');

module.exports = class Email {
    constructor(user, url, institution = null) {
        this.to = user.email;
        this.firstName = user.name.split(' ')[0];
        this.url = url;
        this.from = process.env.EMAIL_FROM;
        this.institution = institution || user.institution;
        
        // Default branding fallback
        this.brandName = this.institution?.name || 'SCMS Finance';
        this.brandColor = '#2563eb'; // Deep blue
        this.logoUrl = this.institution?.logoUrl 
            ? `${process.env.VITE_SERVER_URL || 'http://localhost:3000'}/img/institutions/${this.institution.logoUrl}`
            : null;
    }

    newTransport() {
        // Mailtrap for development
        return nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            auth: {
                user: process.env.EMAIL_USERNAME,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    }

    // Helper to generate the standard branded wrapper
    getBrandedTemplate(content, title = 'Notification') {
        const logoHtml = this.logoUrl 
            ? `<img src="${this.logoUrl}" alt="${this.brandName}" style="max-height: 50px; margin-bottom: 10px;">`
            : `<h1 style="color: #ffffff; margin: 0; font-size: 24px;">${this.brandName}</h1>`;

        return `
            <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #f1f5f9; border-radius: 16px; overflow: hidden; background: #ffffff; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                <div style="background-color: ${this.brandColor}; padding: 30px 20px; text-align: center;">
                    ${logoHtml}
                    <div style="font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 2px; margin-top: 5px;">${title}</div>
                </div>
                <div style="padding: 40px 30px;">
                    <p style="margin-top: 0; font-size: 16px;">Dear ${this.firstName},</p>
                    ${content}
                    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 14px; color: #64748b;">
                        Best regards,<br>
                        <strong>The ${this.brandName} Team</strong>
                    </p>
                </div>
                <div style="padding: 20px; text-align: center; background: #f8fafc; border-top: 1px solid #f1f5f9;">
                    <p style="margin: 0; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">
                        &copy; ${new Date().getFullYear()} ${this.brandName}. All rights reserved.
                    </p>
                </div>
            </div>
        `;
    }

    // Send the actual email
    async send(subject, text, html = null) {
        // 1) Define email options
        const mailOptions = {
            from: `"${this.brandName}" <${this.from}>`,
            to: this.to,
            subject,
            text,
            html: html || this.getBrandedTemplate(`<p>${text.replace(/\n/g, '<br>')}</p>`, 'General Notification')
        };

        // 2) Create a transport and send email
        try {
            logger.info(`Attempting to send email to ${this.to} with subject: ${subject}`);
            const info = await this.newTransport().sendMail(mailOptions);
            logger.info(`Email sent successfully: ${info.messageId}`);
            if (process.env.EMAIL_HOST === 'smtp.ethereal.email' || process.env.EMAIL_HOST === 'smtp.mailtrap.io') {
                logger.info(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
            }
        } catch (error) {
            logger.error(`Error sending email to ${this.to}:`, error);
            throw error;
        }
    }

    async sendPasswordReset() {
        const subject = `Password Reset Request - ${this.brandName}`;
        const content = `
            <p>We received a request to reset your password for your account at <strong>${this.brandName}</strong>.</p>
            <p>To proceed, please click the button below within the next 10 minutes:</p>
            <div style="text-align: center; margin: 35px 0;">
                <a href="${this.url}" style="background-color: ${this.brandColor}; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset My Password</a>
            </div>
            <p style="font-size: 12px; color: #94a3b8; text-align: center;">If you did not request this, you can safely ignore this email.</p>
        `;
        await this.send(subject, `Reset your password at ${this.url}`, this.getBrandedTemplate(content, 'Security Update'));
    }

    async sendEmailVerification(token) {
        const subject = `Verify Your Email - ${this.brandName}`;
        const content = `
            <p>Welcome to <strong>${this.brandName}</strong>! Please use the verification code below to confirm your email address and continue your registration:</p>
            <div style="text-align: center; margin: 35px 0;">
                <div style="background-color: #f8fafc; color: ${this.brandColor}; padding: 20px; border-radius: 12px; font-size: 32px; font-weight: 800; border: 2px dashed ${this.brandColor}; display: inline-block; letter-spacing: 5px;">
                    ${token}
                </div>
            </div>
            <p style="font-size: 13px; color: #64748b; text-align: center;">This code will expire in 24 hours.</p>
        `;
        await this.send(subject, `Your verification code is ${token}`, this.getBrandedTemplate(content, 'Account Verification'));
    }

    async sendWelcome() {
        const subject = `Welcome to ${this.brandName}!`;
        const content = `
            <p>Congratulations! Your email has been verified successfully.</p>
            <p>To complete your membership application and enjoy our financial benefits, please log in and complete your profile:</p>
            <div style="text-align: center; margin: 35px 0;">
                <a href="${this.url}" style="background-color: ${this.brandColor}; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Complete Onboarding</a>
            </div>
        `;
        await this.send(subject, `Welcome! Complete your onboarding at ${this.url}`, this.getBrandedTemplate(content, 'Onboarding'));
    }

    async sendOnboardingComplete() {
        const subject = 'Membership Application Received';
        const content = `
            <p>Thank you for completing your membership profile for <strong>${this.brandName}</strong>!</p>
            <p>Your application has been received and is currently being reviewed by our administrative team. We will verify your documents and get back to you shortly.</p>
            <p>You will receive another notification once your account has been activated.</p>
        `;
        await this.send(subject, 'Application Received', this.getBrandedTemplate(content, 'Review in Progress'));
    }

    async sendMembershipApproval() {
        const subject = `🎉 Congratulations! Your Membership is Approved - ${this.brandName}`;
        const content = `
            <div style="text-align: center; margin-bottom: 25px;">
                <div style="display: inline-block; padding: 15px; background: #f0fdf4; border-radius: 50%; margin-bottom: 15px;">
                    <span style="font-size: 40px;">✅</span>
                </div>
                <h2 style="margin: 0; color: #166534;">Application Approved</h2>
            </div>
            <p>We are delighted to inform you that your membership application for <strong>${this.brandName}</strong> has been approved!</p>
            <p>Your accounts have been automatically created, and you now have full access to our financial services, including savings and loan products.</p>
            <div style="text-align: center; margin: 35px 0;">
                <a href="${this.url}" style="background-color: #10b981; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">Go to My Dashboard</a>
            </div>
            <p>Welcome to the family!</p>
        `;
        await this.send(subject, 'Membership Approved', this.getBrandedTemplate(content, 'Welcome Member'));
    }

    async sendApplicationRejected(reason) {
        const subject = `Update on your Application - ${this.brandName}`;
        const content = `
            <p>Thank you for your interest in joining <strong>${this.brandName}</strong>.</p>
            <p>After reviewing your documents, we are unable to approve your application at this time for the following reason:</p>
            <div style="background: #fff5f5; border: 1px solid #fecaca; border-radius: 12px; padding: 20px; margin: 20px 0; color: #991b1b; font-style: italic;">
                "${reason}"
            </div>
            <p>If you have corrected the issue, you may log in and update your profile to resubmit your application.</p>
        `;
        await this.send(subject, `Application Rejected: ${reason}`, this.getBrandedTemplate(content, 'Application Update'));
    }


    async sendFailedDeductionNotice(loan, failedCount) {
        const subject = '⚠️ Loan Payment Deduction Failed - Action Required';
        const text = `Dear ${this.firstName},\n\nWe attempted to deduct your monthly loan payment of ₦${loan.monthlyDeductionAmount} for Loan #${loan.id}, but your savings account has insufficient funds.\n\nLoan Details:\n- Outstanding Balance: ₦${loan.outstandingBalance}\n- Monthly Payment: ₦${loan.monthlyDeductionAmount}\n- Failed Attempts: ${failedCount}/3\n\n⚠️ IMPORTANT: After 3 consecutive failed deductions, your loan will be marked as DEFAULTED and a 2-month extension with additional interest will be automatically applied.\n\nPlease ensure your savings account has sufficient funds before the next deduction attempt.\n\nBest regards,\nSCMS Team`;

        await this.send(subject, text);
    }

    async sendLoanDefaultNotice(loan, extensionInterest, newDueDate) {
        const subject = '🚨 Loan Default - Extension Applied';
        const text = `Dear ${this.firstName},\n\nYour loan (Loan #${loan.id}) has been marked as DEFAULTED due to ${loan.repaymentMode === 'automated' ? 'consecutive failed payment deductions' : 'non-payment by the due date'}.\n\nOriginal Loan Details:\n- Loan Amount: ₦${loan.loanAmount}\n- Outstanding Balance: ₦${loan.outstandingBalance}\n- Original Due Date: ${loan.originalDueDate}\n\nExtension Details:\n- Extension Period: 2 months\n- Additional Interest: ₦${extensionInterest}\n- New Outstanding Balance: ₦${parseFloat(loan.outstandingBalance) + parseFloat(extensionInterest)}\n- New Due Date: ${newDueDate}\n\nPlease make arrangements to clear your outstanding balance to avoid further penalties.\n\nBest regards,\nSCMS Team`;

        await this.send(subject, text);
    }

    async sendSavingsMaturityNotice(plan, finalBalance) {
        const subject = '🎉 Savings Plan Matured - Funds Transferred';
        const text = `Dear ${this.firstName},\n\nCongratulations! Your savings plan (Plan #${plan.id}) has reached maturity.\n\nMaturity Details:\n- Start Date: ${plan.startDate.toISOString().split('T')[0]}\n- Maturity Date: ${plan.maturityDate.toISOString().split('T')[0]}\n- Final Balance: ₦${finalBalance}\n\nThe full balance has been automatically transferred to your main savings account. You can now access these funds for withdrawals or use them for other transactions.\n\nThank you for saving with us!\n\nBest regards,\nSCMS Team`;

        await this.send(subject, text);
    }

    async sendFailedAutoSaveNotice(plan, requiredAmount, availableBalance) {
        const subject = 'ℹ️ Automatic Savings Deposit Skipped';
        const text = `Dear ${this.firstName},\n\nWe attempted to process your automatic monthly deposit to Savings Plan #${plan.id}, but your main savings account has insufficient funds.\n\nDeposit Details:\n- Required Amount: ₦${requiredAmount}\n- Available Balance: ₦${availableBalance}\n- Shortage: ₦${(requiredAmount - availableBalance).toFixed(2)}\n\nℹ️ This month's automatic deposit has been skipped. No penalties apply - we'll try again next month.\n\nTo ensure successful deposits, please maintain sufficient balance in your main savings account.\n\nBest regards,\nSCMS Team`;

        await this.send(subject, text);
    }



    async sendTransactionAlert(transaction, account, type = 'Credit') {
        const subject = `${type} Alert: ₦${parseFloat(transaction.amount).toLocaleString()} - SCMS`;
        
        const isCredit = type.toLowerCase() === 'credit';
        const amountStr = `₦${parseFloat(transaction.amount).toLocaleString()}`;
        
        const html = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #334155; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background: #ffffff;">
                <div style="background-color: ${isCredit ? '#10b981' : '#ef4444'}; padding: 30px 20px; text-align: center;">
                    <div style="font-size: 12px; font-weight: 800; color: #ffffff; opacity: 0.8; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Transaction Alert</div>
                    <div style="font-size: 32px; font-weight: 900; color: #ffffff;">${amountStr}</div>
                </div>
                <div style="padding: 30px;">
                    <p style="margin-top: 0;">Hi ${this.firstName},</p>
                    <p>A <strong>${type.toLowerCase()}</strong> transaction has occurred on your account.</p>
                    
                    <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin: 20px 0;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Reference</td>
                                <td style="padding: 8px 0; text-align: right; font-weight: 600; font-family: monospace;">${transaction.reference}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Amount</td>
                                <td style="padding: 8px 0; text-align: right; color: ${isCredit ? '#10b981' : '#ef4444'}; font-weight: 700;">${amountStr}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Account</td>
                                <td style="padding: 8px 0; text-align: right; font-weight: 600;">XXXX${account.accountNumber.slice(-4)}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Balance</td>
                                <td style="padding: 8px 0; text-align: right; font-weight: 700;">₦${parseFloat(transaction.balanceAfter).toLocaleString()}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <p style="font-size: 13px; color: #64748b;">If you did not authorize this transaction, please contact us immediately.</p>
                </div>
                <div style="padding: 20px; text-align: center; border-top: 1px solid #f1f5f9; background: #fafafa;">
                    <p style="margin: 0; font-size: 11px; color: #94a3b8;">&copy; ${new Date().getFullYear()} SCMS Finance. All rights reserved.</p>
                </div>
            </div>
        `;
        
        await this.send(subject, `Transaction Alert: ${type} of ${amountStr} on account XXXX${account.accountNumber.slice(-4)}. New Balance: ₦${transaction.balanceAfter}`, html);
    }

    async sendLoanDecision(loan, status, remarks) {
        const isApproved = status === 'approved';
        const subject = isApproved
            ? `✅ Loan Application Approved – ₦${parseFloat(loan.loanAmount).toLocaleString()}`
            : `❌ Loan Application Rejected – ₦${parseFloat(loan.loanAmount).toLocaleString()}`;

        const html = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background: #ffffff;">
                <div style="background-color: ${isApproved ? '#2563eb' : '#ef4444'}; padding: 30px 20px; text-align: center;">
                    <div style="font-size: 12px; font-weight: 800; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Loan Application Update</div>
                    <div style="font-size: 28px; font-weight: 900; color: #ffffff;">${isApproved ? '✅ Approved' : '❌ Rejected'}</div>
                </div>
                <div style="padding: 32px;">
                    <p style="margin-top: 0;">Dear ${this.firstName},</p>
                    <p>We have reviewed your loan application and wish to inform you that it has been <strong>${isApproved ? 'approved' : 'rejected'}.</strong></p>
                    <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid ${isApproved ? '#2563eb' : '#ef4444'};">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">Loan Amount</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">₦${parseFloat(loan.loanAmount).toLocaleString()}</td></tr>
                            <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">Duration</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${loan.duration} Months</td></tr>
                            <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">Decision</td><td style="padding: 8px 0; text-align: right; font-weight: 700; color: ${isApproved ? '#2563eb' : '#ef4444'};">${isApproved ? 'APPROVED' : 'REJECTED'}</td></tr>
                        </table>
                    </div>
                    ${!isApproved && remarks ? `
                    <div style="background: #fff5f5; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 20px 0;">
                        <p style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #ef4444; text-transform: uppercase; letter-spacing: 1px;">Reason for Rejection</p>
                        <p style="margin: 0; color: #374151;">${remarks}</p>
                    </div>` : ''}
                    ${isApproved
                        ? '<p>Your loan will proceed to disbursement. Please ensure your bank details are up to date. You will be notified once funds are disbursed.</p>'
                        : '<p>If you believe this decision was made in error, please contact our support team.</p>'
                    }
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${this.url}" style="background-color: ${isApproved ? '#2563eb' : '#64748b'}; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">View My Loans</a>
                    </div>
                </div>
                <div style="padding: 20px; text-align: center; border-top: 1px solid #f1f5f9; background: #fafafa;">
                    <p style="margin: 0; font-size: 11px; color: #94a3b8;">&copy; ${new Date().getFullYear()} SCMS Finance. All rights reserved.</p>
                </div>
            </div>
        `;

        const text = isApproved
            ? `Dear ${this.firstName}, your loan application for ₦${parseFloat(loan.loanAmount).toLocaleString()} has been APPROVED.`
            : `Dear ${this.firstName}, your loan application for ₦${parseFloat(loan.loanAmount).toLocaleString()} has been REJECTED. Reason: ${remarks || 'Not specified'}`;

        await this.send(subject, text, html);
    }

    async sendLoanDisbursement(loan, mode) {
        const subject = `💰 Loan Disbursed – ₦${parseFloat(loan.loanAmount).toLocaleString()}`;
        const isManual = mode === 'manual';

        const html = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background: #ffffff;">
                <div style="background-color: #10b981; padding: 30px 20px; text-align: center;">
                    <div style="font-size: 12px; font-weight: 800; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Funds Released</div>
                    <div style="font-size: 28px; font-weight: 900; color: #ffffff;">₦${parseFloat(loan.loanAmount).toLocaleString()}</div>
                </div>
                <div style="padding: 32px;">
                    <p style="margin-top: 0;">Hi ${this.firstName},</p>
                    <p>Good news! The funds for your loan (Loan #${loan.id}) have been shared successfully via <strong>${isManual ? 'Manual Record' : 'Automated Transfer'}</strong>.</p>
                    
                    <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #10b981;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">Amount</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">₦${parseFloat(loan.loanAmount).toLocaleString()}</td></tr>
                            <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">Bank</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${loan.bankName || 'Registered Account'}</td></tr>
                            <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">Mode</td><td style="padding: 8px 0; text-align: right; font-weight: 600; text-transform: capitalize;">${mode}</td></tr>
                        </table>
                    </div>

                    <p><strong>What happens next?</strong></p>
                    <ul style="padding-left: 20px; color: #475569; font-size: 14px;">
                        <li>Your repayment schedule is now ACTIVE.</li>
                        <li>Payments will be automatically deducted monthly from your savings account.</li>
                        <li>You can view your repayment ledger and dates on your dashboard.</li>
                    </ul>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${this.url}" style="background-color: #10b981; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">View Loan Details</a>
                    </div>
                </div>
                <div style="padding: 20px; text-align: center; border-top: 1px solid #f1f5f9; background: #fafafa;">
                    <p style="margin: 0; font-size: 11px; color: #94a3b8;">&copy; ${new Date().getFullYear()} SCMS Finance. All rights reserved.</p>
                </div>
            </div>
        `;

        const text = `Hi ${this.firstName}, your loan of ₦${parseFloat(loan.loanAmount).toLocaleString()} has been disbursed successfully. Log in to view details.`;

        await this.send(subject, text, html);
    }

    async sendInstitutionWelcome(institution, password) {
        const subject = `🏢 Welcome to SCMS! Institution Account Created: ${institution.name}`;
        
        const html = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background: #ffffff;">
                <div style="background-color: #2563eb; padding: 30px 20px; text-align: center;">
                    <div style="font-size: 12px; font-weight: 800; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Institution Onboarding</div>
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Welcome to SCMS</h1>
                </div>
                <div style="padding: 32px;">
                    <p style="margin-top: 0;">Dear ${this.firstName},</p>
                    <p>Congratulations! Your institution, <strong>${institution.name}</strong>, has been successfully onboarded onto the SCMS platform.</p>
                    
                    <div style="background: #f8fafc; padding: 25px; border-radius: 12px; margin: 24px 0; border: 1px solid #e2e8f0;">
                        <h3 style="margin-top: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Your Admin Credentials</h3>
                        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                            <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">Login Email</td><td style="padding: 8px 0; text-align: right; font-weight: 600; color: #2563eb;">${this.to}</td></tr>
                            <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">Temporary Password</td><td style="padding: 8px 0; text-align: right; font-weight: 700; color: #1e293b; font-family: monospace; font-size: 16px;">${password}</td></tr>
                            <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">Institution Code</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${institution.code}</td></tr>
                        </table>
                    </div>

                    <p><strong>Next Steps:</strong></p>
                    <ol style="padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.8;">
                        <li>Log in using the credentials above.</li>
                        <li>Change your password immediately for security.</li>
                        <li>Update your Institution Profile (Logo, Address, etc.).</li>
                        <li>Configure your default interest rates and thrift settings.</li>
                        <li>Start onboarding your staff and members!</li>
                    </ol>

                    <div style="text-align: center; margin: 35px 0;">
                        <a href="${this.url}" style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">Login to Dashboard</a>
                    </div>
                    
                    <p style="font-size: 12px; color: #94a3b8; text-align: center;">For security reasons, do not share these credentials with anyone.</p>
                </div>
                <div style="padding: 20px; text-align: center; border-top: 1px solid #f1f5f9; background: #fafafa;">
                    <p style="margin: 0; font-size: 11px; color: #94a3b8;">&copy; ${new Date().getFullYear()} SCMS Finance. All rights reserved.</p>
                </div>
            </div>
        `;

        const text = `Welcome to SCMS! Your institution ${institution.name} has been created. Admin Email: ${this.to}, Temp Password: ${password}. Log in at ${this.url}`;

        await this.send(subject, text, html);
    }

    async sendWithdrawalApproval(amount, reason) {
        const subject = `Withdrawal Approved - ${this.brandName}`;
        const content = `
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 40px; margin-bottom: 10px;">✅</div>
                <h2 style="margin: 0; color: #059669;">Withdrawal Approved</h2>
            </div>
            <p>Your withdrawal request has been approved and processed.</p>
            <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #e2e8f0;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="padding: 5px 0; color: #64748b;">Amount</td><td style="padding: 5px 0; text-align: right; font-weight: bold; color: #1e293b;">₦${parseFloat(amount).toLocaleString()}</td></tr>
                    <tr><td style="padding: 5px 0; color: #64748b;">Description</td><td style="padding: 5px 0; text-align: right; font-weight: bold; color: #1e293b;">${reason || 'Cash withdrawal'}</td></tr>
                    <tr><td style="padding: 5px 0; color: #64748b;">Date</td><td style="padding: 5px 0; text-align: right; font-weight: bold; color: #1e293b;">${new Date().toLocaleDateString()}</td></tr>
                </table>
            </div>
            <p>The funds have been deducted from your account. If you provided bank details, the transfer has been initiated.</p>
        `;
        await this.send(subject, `Your withdrawal of ₦${parseFloat(amount).toLocaleString()} has been approved.`, this.getBrandedTemplate(content, 'Financial Update'));
    }

    async sendWithdrawalRejection(amount, reason) {
        const subject = `Withdrawal Request Update - ${this.brandName}`;
        const content = `
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 40px; margin-bottom: 10px;">❌</div>
                <h2 style="margin: 0; color: #dc2626;">Withdrawal Rejected</h2>
            </div>
            <p>We are sorry, but your withdrawal request for <strong>₦${parseFloat(amount).toLocaleString()}</strong> could not be approved at this time.</p>
            <div style="background: #fff1f2; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #fecdd3;">
                <p style="margin: 0; font-size: 13px; color: #9f1239; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Reason for Rejection:</p>
                <p style="margin: 0; color: #be123c; font-weight: 500;">${reason}</p>
            </div>
            <p>If you believe this is an error or have questions, please contact our support team or visit our office.</p>
        `;
        await this.send(subject, `Your withdrawal request for ₦${parseFloat(amount).toLocaleString()} was rejected: ${reason}`, this.getBrandedTemplate(content, 'Account Update'));
    }

    async sendPlatformAdminWelcome(password) {
        const subject = `🛡️ Platform Access Granted - ${this.brandName}`;
        const url = `${process.env.VITE_CLIENT_URL || 'http://localhost:5173'}/login`;
        
        const html = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background: #ffffff;">
                <div style="background-color: #006a61; padding: 30px 20px; text-align: center;">
                    <div style="font-size: 12px; font-weight: 800; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Administrative Privileges</div>
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Welcome to the Command Center</h1>
                </div>
                <div style="padding: 32px;">
                    <p style="margin-top: 0;">Dear ${this.firstName},</p>
                    <p>You have been officially granted **Platform Administrator** access to <strong>${this.brandName}</strong>. You now have global oversight and management capabilities across the entire platform.</p>
                    
                    <div style="background: #f0fdfa; padding: 25px; border-radius: 12px; margin: 24px 0; border: 1px solid #ccfbf1;">
                        <h3 style="margin-top: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #006a61;">Access Credentials</h3>
                        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                            <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">Admin Email</td><td style="padding: 8px 0; text-align: right; font-weight: 600; color: #006a61;">${this.to}</td></tr>
                            <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">Access Password</td><td style="padding: 8px 0; text-align: right; font-weight: 700; color: #1e293b; font-family: monospace; font-size: 16px;">${password}</td></tr>
                            <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">Security Level</td><td style="padding: 8px 0; text-align: right; font-weight: 800; color: #0f766e;">SUPER ADMIN</td></tr>
                        </table>
                    </div>

                    <p><strong>Security Protocols:</strong></p>
                    <ul style="padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.8;">
                        <li>Change your password immediately upon your first login.</li>
                        <li>Do not share these credentials with anyone, including other staff.</li>
                        <li>Always log out of the Management Console when not in use.</li>
                    </ul>

                    <div style="text-align: center; margin: 35px 0;">
                        <a href="${url}" style="background-color: #006a61; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 106, 97, 0.2);">Access Management Console</a>
                    </div>
                    
                    <p style="font-size: 12px; color: #94a3b8; text-align: center;">This is an automated security notification. If you were not expecting this access, please contact the Platform Owner immediately.</p>
                </div>
                <div style="padding: 20px; text-align: center; border-top: 1px solid #f1f5f9; background: #f8fafc;">
                    <p style="margin: 0; font-size: 11px; color: #94a3b8;">&copy; ${new Date().getFullYear()} NoCall Cooperative. All rights reserved.</p>
                </div>
            </div>
        `;

        const text = `Platform Access Granted! Your Admin Email: ${this.to}, Password: ${password}. Access the console at ${url}`;

        await this.send(subject, text, html);
    }
};
