# WhatsApp Message Sender

This is a Node.js application that uses WPPConnect to send WhatsApp messages and manage contacts.

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)
- A WhatsApp account

## Installation

1. Clone this repository or download the files
2. Install the dependencies:

```bash
npm install
```

## Usage

1. Start the server:

```bash
node index.js
```

2. When you first run the application, it will generate a QR code in the console. Scan this QR code with your WhatsApp mobile app to authenticate.

3. Once authenticated, you can use the following API endpoints:

### Send a Message

```bash
POST http://localhost:3000/send-message
Content-Type: application/json

{
    "phone": "1234567890",  // Include country code
    "message": "Hello from WPPConnect!"
}
```

### Get All Contacts

```bash
GET http://localhost:3000/contacts
```

## Important Notes

- Phone numbers should include the country code without any special characters
- Make sure to keep your WhatsApp session active
- The server runs on port 3000 by default

## Security Considerations

- This is a basic implementation. For production use, add proper security measures
- Don't expose the API endpoints publicly without proper authentication
- Keep your WhatsApp session tokens secure
