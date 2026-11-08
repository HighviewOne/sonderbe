# Homeowner outreach letter — DRAFT (needs attorney review before mailing)

Mailed to owners at addresses with a recorded Notice of Default (from the NOD pipeline).
One page, plain envelope, no fake "official notice" styling, no urgency tricks.
A Spanish version should go in the same envelope or on the back. Ask a native speaker to
check the translation.

---

[SonderBe logo]
[Business name] · [Mailing address] · [Phone] · [website]

[Date]

[Owner name]
[Property address]

Dear [Owner name],

Public records show that a Notice of Default was recently recorded on your home. If you're
already working with your lender or a housing counselor, you can ignore this letter. If not,
please know that **you still have time, and you have options.**

In California, a home usually can't be sold at a trustee sale until at least three months
after a Notice of Default is recorded, plus at least 20 more days after a Notice of Sale. Many
homeowners use that time to arrange a loan modification, a repayment plan, a refinance, or a
sale on their own terms.

**SonderBe is a free website that helps you get organized.** It gives you:

- A plain-language guide to your options
- A checklist of the documents lenders usually ask for, so you know what to gather
- Links to **free** HUD-approved housing counselors and California legal aid

If you'd like, you can also ask SonderBe to connect you with **one** local real estate
professional who works with homeowners in your situation. You decide if and when. You can
withdraw at any time, and **SonderBe never charges homeowners.**

Visit **[website]** or call **[phone]**.

Please protect yourself: **never pay anyone upfront to stop a foreclosure,** and never sign
over the deed to your home to someone who promises to save it. In California, it's illegal to
charge an advance fee for loan modification help. Free help is always available from a
HUD-approved housing counselor: **1-800-569-4287** or hud.gov/findacounselor.

Sincerely,

[Your name]
[Business name]

---

<small>SonderBe is not a lender, law firm, or government agency, and is not affiliated with
your lender or loan servicer. This letter is not legal or financial advice. The information
came from public records filed with the [County] County Recorder. To stop receiving mail
from us, call [phone] or email [email].</small>

---

## Before mailing (attorney checklist)

- [ ] Confirm the letter and the matching model aren't a "foreclosure consultant" solicitation
      under Civil Code §2945 et seq., or what changes would make sure they aren't.
- [ ] Confirm the timeline sentence is accurate and can't be read as a promise.
- [ ] Review the consent wording in the app (`server/src/matching.ts`) together with this letter.
- [ ] Decide if any required disclosures are missing (e.g. a business address or a license number).
- [ ] Check Spanish (and possibly Vietnamese, Korean, Chinese, Tagalog) versions: Civil Code §1632
      translation rules can apply to some foreclosure-related contracts. Ask whether they reach this letter.
- [ ] Keep a do-not-mail list and honor it in the NOD mailout before every run.
- [ ] Mail only. Don't call or text NOD homeowners (TCPA, and the CallAI guardrail).

## Tracking

Print a unique short URL or code per batch (e.g. `[website]/?src=oc1108`) so you can measure
the response rate per county and per mailing. That number is what agents will ask for.
(Not built yet: the site doesn't record `src` today. It's a small change: save it on signup.)
