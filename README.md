# Franklin Logistics Billing System

An AI-powered Progressive Web Application (PWA) developed for **Franklin Logistics** to simplify invoice processing and billing management. The application automates invoice data extraction from PDF and image files using Google Gemini AI, reducing manual data entry and improving billing accuracy.

---

## Overview

The Franklin Logistics Billing System is designed to digitize invoice processing by extracting key billing information from uploaded documents. Users can review extracted data before saving, manage billing records, detect duplicate invoices, and synchronize data with Google Sheets.

The application works offline using IndexedDB and can be installed as a Progressive Web App for desktop and mobile devices.

---

## Features

### AI Invoice Extraction
- Upload invoice PDFs or images
- Automatic extraction of invoice details using Google Gemini AI
- Intelligent field detection with editable results

### Invoice Management
- Store and organize billing records
- Edit extracted information before saving
- Duplicate invoice detection
- Transaction history management

### Dashboard
- Billing summary
- Financial overview
- Recent transactions
- Analytics cards

### Google Sheets Integration
- Export billing records
- Synchronize data with Google Sheets

### Offline Support
- Works without internet connection
- Local storage using IndexedDB (Dexie)

### Progressive Web App
- Installable on desktop and mobile
- Fast loading
- Responsive design

---

## Technology Stack

### Frontend
- React 19
- TypeScript
- Vite
- Tailwind CSS

### AI & Document Processing
- Google Gemini AI
- PDF.js

### Database
- IndexedDB
- Dexie

### Tools
- Git
- GitHub
- npm

---

## Project Structure

```
src/
│
├── components/
├── pages/
├── hooks/
├── lib/
├── services/
├── types/
├── utils/
├── assets/
└── App.tsx
```

---

## Workflow

1. Upload a PDF or image invoice.
2. AI extracts invoice information.
3. Review and edit extracted fields if required.
4. Save the invoice.
5. View billing history and summaries.
6. Export or synchronize records with Google Sheets.

---

## Installation

### Clone Repository

```bash
git clone https://github.com/lucifer11125/Franklin-logistics-billing-system-.git
```

### Navigate to Project

```bash
cd Franklin-logistics-billing-system-
```

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

Create a `.env` file.

```env
VITE_GEMINI_API_KEY=YOUR_API_KEY
```

### Run Development Server

```bash
npm run dev
```

### Build

```bash
npm run build
```

---

## Future Enhancements

- User authentication
- Cloud database integration
- Multi-user support
- Role-based access
- REST API backend
- GST reporting
- Email invoice sharing
- Barcode & QR code scanning

---

## Business Benefits

- Reduces manual invoice entry
- Improves billing accuracy
- Faster invoice processing
- AI-assisted document digitization
- Offline accessibility
- Easy data export and reporting

---

## Author

**Harsh Chauhan**

B.Tech Computer Science & Engineering (Big Data & Cloud Engineering)

MIT ADT University

GitHub: https://github.com/lucifer11125

---

## License

This project was developed as a client solution for **Franklin Logistics**. Source code is provided for educational and portfolio purposes unless otherwise restricted by the client.
