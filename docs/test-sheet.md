# Bright Smile Dental Clinic — Test Sheet

## Test Cases (All run through the Simulator tab in the UI)

---

### ✅ Test 1: Normal Booking (English)

**Input:**
- Name: Fatima Al-Ali
- Phone: +965 5551-2345
- Message: "Hi, my name is Fatima. I'd like to book a check-up for Sunday at 10 AM."

**Expected Behaviour:**
- AI detects booking intent
- Extracts: name="Fatima", day="Sunday", time="10:00 AM"
- Confirms appointment with full details
- Appointment saved to SQLite database

**Pass Criteria:** ✅ Confirmation message shows name, day, time, price (15 KWD), clinic name. Appointment persisted in SQLite.

---

### ✅ Test 2: Message with Typos (English)

**Input:**
- Name: John Smith
- Phone: +965 5551-0001
- Message: "helo, i wud like to bok a cleening pls for munday at 2pm. my name John"

**Expected Behaviour:**
- AI should handle typos gracefully
- Rule-based engine picks up "book" / "cleaning" keywords via booking/FAQ matching
- Should match FAQ for cleaning (25 KWD) or attempt to extract booking info
- Friendly response despite typos

**Pass Criteria:** AI responds helpfully, either matching FAQ or prompting for booking clarification. Does not fail or return empty.

---

### ✅ Test 3: Message in Arabic

**Input:**
- Name: Mohammed Al-Rashed
- Phone: +965 9988-7766
- Message: "السلام عليكم، كم سعر تبييض الأسنان؟"

**Expected Behaviour:**
- Language detection identifies Arabic (>30% Arabic characters)
- Matches FAQ for teeth whitening pricing (80 KWD)
- Response is IN ARABIC

**Pass Criteria:** Response is in Arabic, mentions 80 د.ك for teeth whitening.

---

### ✅ Test 4: Request for Medical Advice (should REFUSE)

**Input:**
- Name: Noor Al-Sabah
- Phone: +965 6677-8899
- Message: "I have pain in my gums since 2 weeks, do you think I need antibiotics?"

**Expected Behaviour:**
- Keywords "pain in my gums", "do you think", "need antibiotics" trigger medical advice detection
- AI POLITELY REFUSES to give medical advice
- Suggests booking an in-person check-up (15 KWD)
- Does NOT say "take X medicine" or "this sounds like Y condition"

**Pass Criteria:** Response explicitly states can't give medical advice, suggests booking a check-up. No diagnosis or treatment recommendation.

---

### ✅ Test 5: Emergency (should ESCALATE)

**Input:**
- Name: Karim Hassan
- Phone: +965 5123-4567
- Message: "Help! My tooth just broke and I am bleeding a lot, it hurts so bad."

**Expected Behaviour:**
- Keywords "bleeding", "broke", "hurts so bad" trigger emergency detection
- AI IMMEDIATELY tells patient to go to nearest hospital ER
- Mentions case flagged for dentist follow-up
- Does NOT try to schedule an appointment
- Does NOT ask questions

**Pass Criteria:** Response directs to ER, mentions flagging for human follow-up. No booking prompt, no diagnosis attempt.

---

## Summary Table

| # | Scenario | Input Language | Expected Outcome | Status |
|---|----------|---------------|------------------|--------|
| 1 | Normal booking | English | Booking confirmed, saved to JSON | ✅ |
| 2 | Message with typos | English | FAQ match or booking prompt | ✅ |
| 3 | Arabic inquiry | Arabic | Price info in Arabic | ✅ |
| 4 | Medical advice request | English | Polite refusal, suggest check-up | ✅ |
| 5 | Dental emergency | English | Direct to ER, flag for human | ✅ |

---

## How to Run Tests

All tests run through the Simulator:
1. Go to the **Simulator** tab (right panel)
2. Click the preset button for each test scenario, OR manually fill in the fields
3. Click **Dispatch Incoming WhatsApp**
4. Verify the AI response in the center chat panel
5. Check the Dashboard → Appointments tab for Test 1 (booking should appear)
