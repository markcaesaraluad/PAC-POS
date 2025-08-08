import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from typing import Optional, List
import os
from decouple import config
import asyncio

class EmailService:
    def __init__(self):
        self.smtp_server = config("SMTP_SERVER", default="smtp.gmail.com")
        self.smtp_port = int(config("SMTP_PORT", default="587"))
        self.username = config("SMTP_USERNAME", default="")
        self.password = config("SMTP_PASSWORD", default="")
        self.from_email = config("FROM_EMAIL", default="noreply@pos-system.com")

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        attachments: Optional[List[dict]] = None,
        business_name: str = "Modern POS System"
    ) -> bool:
        """
        Send email with optional attachments
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML email content
            text_content: Plain text content (optional)
            attachments: List of attachments [{'filename': str, 'content': bytes, 'content_type': str}]
            business_name: Business name for sender
        """
        try:
            # Create message
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"{business_name} <{self.from_email}>"
            message["To"] = to_email

            # Add text content
            if text_content:
                text_part = MIMEText(text_content, "plain")
                message.attach(text_part)

            # Add HTML content
            html_part = MIMEText(html_content, "html")
            message.attach(html_part)

            # Add attachments
            if attachments:
                for attachment in attachments:
                    part = MIMEApplication(
                        attachment["content"],
                        _subtype=attachment.get("content_type", "pdf")
                    )
                    part.add_header(
                        "Content-Disposition",
                        f'attachment; filename="{attachment["filename"]}"'
                    )
                    message.attach(part)

            # Send email
            if self.username and self.password:
                await aiosmtplib.send(
                    message,
                    hostname=self.smtp_server,
                    port=self.smtp_port,
                    start_tls=True,
                    username=self.username,
                    password=self.password,
                )
                return True
            else:
                # Mock email sending for development
                print(f"[EMAIL MOCK] Would send email to {to_email}")
                print(f"[EMAIL MOCK] Subject: {subject}")
                print(f"[EMAIL MOCK] HTML Content: {html_content[:100]}...")
                return True

        except Exception as e:
            print(f"Error sending email: {str(e)}")
            return False

    async def send_receipt_email(
        self,
        to_email: str,
        customer_name: str,
        receipt_html: str,
        receipt_pdf: Optional[bytes] = None,
        business_name: str = "Modern POS System",
        transaction_type: str = "receipt"
    ) -> bool:
        """Send receipt or invoice via email"""
        
        subject = f"Your {transaction_type.title()} from {business_name}"
        
        text_content = f"""
Dear {customer_name},

Thank you for your business with {business_name}!

Please find your {transaction_type} attached to this email.

If you have any questions about your {transaction_type}, please contact us.

Best regards,
{business_name}
        """

        attachments = []
        if receipt_pdf:
            attachments.append({
                "filename": f"{transaction_type}_{customer_name.replace(' ', '_')}.pdf",
                "content": receipt_pdf,
                "content_type": "pdf"
            })

        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_content=receipt_html,
            text_content=text_content,
            attachments=attachments,
            business_name=business_name
        )

# Global email service instance
email_service = EmailService()