# 🛡️ The 'Silicon Valley' Master Data Protocol

हे डॉक्युमेंट आपल्या ERP मधील सर्व **Master Data Modules** (उदा. Subjects, Classes, Branches, Fee Categories, Roles) साठी एक 'Standard Operating Procedure' (SOP) म्हणून काम करेल.

आपण 'Subject Module' मध्ये ज्या ज्या गोष्टी इम्प्लिमेंट केल्या, त्यामागचा 'Real-World 360-Degree Analysis' आणि 'Rules' खालीलप्रमाणे आहेत:

---

## 1. Database Layer (The Absolute Foundation)
Real-world मध्ये युझर्स एकाच वेळी डेटा ॲड करू शकतात (Race Condition) किंवा API लेव्हलला फसवू शकतात. त्यामुळे सर्व सुरक्षा डेटाबेस लेव्हलला असणं अनिवार्य आहे.

*   **Rule 1: The `isActive` Flag:** कोणताही मास्टर डेटा कधीही थेट डिलीट होणार नाही. त्याला `isActive: true/false` हा टॉगल असेल. (Soft Archive).
*   **Rule 2: Double Unique Constraints:** 
    *   `@@unique([organizationId, code])`
    *   `@@unique([organizationId, name])`
    *   *Why?* API मधून जरी दोन क्लार्कनी एकाच सेकंदाला 'English' ॲड करायचा प्रयत्न केला (वेगळ्या कोडने), तरी MySQL डेटाबेस स्वतःच एकाला ब्लॉक करेल. जगातली कोणतीही ताकद एकाच नावाचे दोन रेकॉर्ड्स घुसवू शकणार नाही.

---

## 2. Validation Layer (The Gatekeeper - Zod)
युझर्स घाईघाईत टायपिंग करताना चुका (Typos) करतात, जसे की नावाच्या शेवटी Space सोडणे.

*   **Rule 3: Automatic Sanitization:**
    *   प्रत्येक String ला `.trim()` लावणं सक्तीचं आहे. ("English " हे आपोआप "English" होईल).
    *   प्रत्येक Code ला `.toUpperCase()` लावणं सक्तीचं आहे. (`eng` हे आपोआप `ENG` होईल).
    *   *Why?* डेटाबेसमध्ये जातानाच डेटा १००% स्वच्छ (Clean) गेला पाहिजे.

---

## 3. Backend API Layer (The Smart Validator)

### A. Create Mode (`POST`)
*   **Rule 4: Separate Checks for Code & Name:** 
    *   **Check 1 (Code):** कोड आधीच वापरला आहे का? (Active असो वा Inactive). जर असेल, तर कडक एरर द्या: *"This code is already in use."* (येथे Restore चा ऑप्शन देऊ नका, कारण कोड चुकीचा टाकणं हा युझरचा Typo असू शकतो).
    *   **Check 2 (Name):** नाव आधीच वापरलं आहे का? 
        *   जर विषय **Active** असेल -> कडक एरर द्या.
        *   जर विषय **Inactive (Archived)** असेल -> कडक एरर देऊ नका! त्याऐवजी `ARCHIVED_CONFLICT` हा खास एरर पाठवा आणि सोबत त्या जुन्या विषयाचा `id` पाठवा.

### B. Edit Mode (`PATCH`)
*   **Rule 5: No Restore in Edit Mode:**
    *   जर युझर जुना विषय एडिट करून त्याला आधीच अस्तित्वात असलेल्या दुसऱ्या विषयाचं नाव देत असेल, तर त्याला थेट `409 Conflict` (एरर) द्या.
    *   *Why?* एडिट करताना 'Restore' चा ऑप्शन दिल्यास, युझर गोंधळून जाऊन चुकीचा विषय Restore करेल आणि त्याचे एडिट्स वाया जातील. (UX Disaster).

### C. Delete Mode (`DELETE`)
*   **Rule 6: The Dependency Blocker:**
    *   जर मास्टर डेटाचा वापर कुठेही (उदा. एखाद्या मुलासाठी किंवा पावतीत) झाला असेल, तर तो विषय डेटाबेसमधून 'Hard Delete' होता कामा नये.
    *   *Why?* डेटा उडवला तर 'Historical Records' (उदा. ५ वर्षांपूर्वीचे रिझल्ट्स) क्रॅश होतील.
    *   *Action:* सिस्टीमने `409 HAS_DEPENDENCIES` एरर द्यावा आणि युझरला तो विषय 'Inactive' (बंद) करायचा सल्ला द्यावा.

---

## 4. Frontend UI Layer (The Proactive UX)
युझरला कधीही Dumb Errors दाखवायचे नाहीत; सिस्टीमने स्वतः योग्य मार्ग सुचवला पाहिजे.

### A. The Smart Restore Pop-up (Data Deduplication)
*   **Rule 7:** जेव्हा बॅकएंड `ARCHIVED_CONFLICT` देईल, तेव्हा फॉर्म गायब करून एक सुंदर अलर्ट दाखवा:
    > *"A record with this name is currently Archived. Creating a duplicate will fragment historical records. Would you like to restore it?"*
*   त्यात **"Restore"** नावाचं बटण द्या, जे एका क्लिकवर जुना विषय पुन्हा ॲक्टिव्ह करेल.

### B. Smart Table Sorting & Visuals
*   **Rule 8: Active First, Inactive Last:** 
    *   बॅकएंडने डेटा पाठवताना `orderBy: [{ isActive: "desc" }, { name: "asc" }]` ने पाठवावा. म्हणजे चालू विषय नेहमी वर राहतील.
*   **Rule 9: Visual Dimming:** 
    *   Inactive विषय टेबलमध्ये वेगळे दिसले पाहिजेत (उदा. `opacity-60`, `line-through` आणि **"ARCHIVED"** चा बॅज).
*   **Rule 10: Toggle Filter:**
    *   टेबलच्या वर **"Show Inactive"** चा स्विच असावा, जेणेकरून रोजच्या कामात बंद असलेले विषय अडथळा आणणार नाहीत.

---

### Conclusion (The 360-Degree Thought Process)
हा प्रोटोकॉल युझरच्या प्रत्येक मानवी चुकीला (Human Error - Spaces, Typos, Race Conditions) डेटाबेस आणि API लेव्हलवर ब्लॉक करतो. त्याचवेळी, डेटा खराब होण्यापासून वाचवण्यासाठी युझरला अत्यंत प्रेमाने 'Restore' च्या मार्गावर आणतो. **भविष्यात कोणताही नवीन 'Master Data' बनवताना आपण हाच डॉक्युमेंट बेसलाईन (Baseline) म्हणून वापरू.**
