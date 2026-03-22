export type Language = "en" | "hi";

export const translations = {
  en: {
    // Navigation
    "nav.home": "Home",
    "nav.bills": "Bills",
    "nav.parties": "Parties",
    "nav.payments": "Payments",
    "nav.measures": "Measures",
    "nav.upload": "Upload",
    "nav.myuploads": "My Uploads",
    "nav.recordpayment": "Record Payment",
    "nav.addparty": "Add Party",
    
    // Header
    "header.search": "Search inside DoorCraft Pro...",
    "header.profile": "Profile",
    "header.logout": "Log Out",
    "header.language": "Language",

    // Dashboard
    "dash.title": "Dashboard",
    "dash.overview": "Business overview at a glance",
    "dash.receivable": "Receivable",
    "dash.payable": "Payable",
    "dash.collected": "Collected (Mo)",
    "dash.totalBills": "Total Bills",
    "dash.billsCount": "bills",

    // Bills
    "bills.new": "Create New Bill",
    "bills.edit": "Edit Bill",
    "bills.customer": "Customer Name",
    "bills.saveDraft": "Save Draft",
    "bills.finalize": "Finalize Bill",
  },
  hi: {
    // Navigation
    "nav.home": "होम",
    "nav.bills": "बिल",
    "nav.parties": "पार्टियां",
    "nav.payments": "भुगतान",
    "nav.measures": "माप",
    "nav.upload": "अपलोड करें",
    "nav.myuploads": "मेरे अपलोड",
    "nav.recordpayment": "भुगतान दर्ज करें",
    "nav.addparty": "पार्टी जोड़ें",

    // Header
    "header.search": "खोजें...",
    "header.profile": "प्रोफ़ाइल",
    "header.logout": "लॉग आउट",
    "header.language": "भाषा",

    // Dashboard
    "dash.title": "डैशबोर्ड",
    "dash.overview": "व्यापार का अवलोकन",
    "dash.receivable": "प्राप्य",
    "dash.payable": "देय",
    "dash.collected": "एकत्रित (महीने)",
    "dash.totalBills": "कुल बिल",
    "dash.billsCount": "बिल",

    // Bills
    "bills.new": "नया बिल बनाएं",
    "bills.edit": "बिल संपादित करें",
    "bills.customer": "ग्राहक का नाम",
    "bills.saveDraft": "ड्राफ्ट सहेजें",
    "bills.finalize": "बिल पक्का करें",
  }
} as const;

export type TranslationKey = keyof typeof translations.en;
