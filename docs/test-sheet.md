# WhatsApp SmartSupport — Test Sheet

## Test Cases (All run through the Simulator tab in the UI)

---

### ✅ Test 1: Normal Booking (English)

**Input:**
- Name: Fatima Al-Ali
- Phone: +965 5551-2345
- Message: "Hi, my name is Fatima. I'd like to book an appointment for Monday at 10 AM."

**Expected Behaviour:**
- AI detects booking intent
- Extracts: name="Fatima", day="Monday", time="10:00 AM"
- Confirms appointment with full details
- Appointment saved to SQLite database

**Pass Criteria:** Confirmation message shows name, day, time. Appointment persisted in SQLite.

---

### ✅ Test 2: Message with Typos (English)

**Input:**
- Name: John Smith
- Phone: +965 5551-0001
- Message: "helo, i wud like to bok an apointment pls for munday at 2pm. my name John"

**Expected Behaviour:**
- AI should handle typos gracefully
- Rule-based engine picks up "book" keywords via booking matching
- Friendly response despite typos

**Pass Criteria:** AI responds helpfully, either confirming booking or prompting for clarification. Does not fail or return empty.

---

### ✅ Test 3: Message in Arabic

**Input:**
- Name: Mohammed Al-Rashed
- Phone: +965 9988-7766
- Message: "السلام عليكم، ما هي ساعات العمل؟"

**Expected Behaviour:**
- Language detection identifies Arabic
- Matches FAQ for business hours
- Response is IN ARABIC

**Pass Criteria:** Response is in Arabic, mentions business hours.

---

### ✅ Test 4: FAQ Inquiry

**Input:**
- Name: Noor Al-Sabah
- Phone: +965 6677-8899
- Message: "What services do you offer? I need help with my account."

**Expected Behaviour:**
- AI matches FAQ for services or provides a helpful response
- Does not make up information not in the knowledge base

**Pass Criteria:** Response is relevant and helpful, matches FAQ or provides contact guidance.

---

### ✅ Test 5: Off-Topic Message

**Input:**
- Name: Karim Hassan
- Phone: +965 5123-4567
- Message: "I want to order a pizza with extra cheese and pepperoni."

**Expected Behaviour:**
- AI recognizes the message is outside business scope
- Politely redirects or offers relevant help

**Pass Criteria:** Response acknowledges the message is off-topic, offers to help with relevant business matters.

---

## Summary Table

| # | Scenario | Input Language | Expected Outcome | Status |
|---|----------|---------------|------------------|--------|
| 1 | Normal booking | English | Booking confirmed, saved to DB | ✅ |
| 2 | Message with typos | English | Booking match or clarification prompt | ✅ |
| 3 | Arabic inquiry | Arabic | Hours info in Arabic | ✅ |
| 4 | FAQ inquiry | English | Relevant FAQ response | ✅ |
| 5 | Off-topic message | English | Polite redirection | ✅ |

---

## How to Run Tests

All tests run through the Simulator:
1. Go to the **Simulator** tab (right panel)
2. Click the preset button for each test scenario, OR manually fill in the fields
3. Click **Dispatch Incoming WhatsApp**
4. Verify the AI response in the center chat panel
5. Check the Dashboard → Appointments tab for Test 1 (booking should appear)
