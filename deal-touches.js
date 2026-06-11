/* Shared Constant Contact / Customer-Touch library.
   The post-sale touch cadence keyed by Salesforce stage number (4..10), plus the
   helpers that personalize a message for a deal. Loaded by My Calls (Deals in
   Progress) and the rep profile (/me/ Top Action Items) so both stay in sync.
   Attached to window (not top-level const) so a page can also keep a local copy
   without a redeclaration clash. */
(function () {
  window.DP_TOUCHES = {
    4: [
      { key: "call24", label: "24-Hour Call", channel: "Call", msg: "(Phone call, not a text.) Reinforce the decision and answer the questions that surfaced overnight. Schedule a specific time before you leave the home, then call exactly when promised." },
      { key: "submitted", label: "Submitted & Tracking", channel: "Text", msg: "Hey [Customer], great news. 🎉 Your project's been submitted and is now with our Quality Control team for a full structural and electrical review. Once it clears, it heads to design and engineering. Some projects take up to 5-6 months depending on permits and approvals, but we're on it, and I'll guide you through the whole journey." }
    ],
    5: [
      { key: "engineering", label: "Engineering", channel: "Text", msg: "Hi [Customer], quick update. Your project officially moved to our Design and Engineering team to prep the next application phase. 🚀 There's still a small chance we run into utility restrictions, but you're with Trinity Solar, 30 years strong and second to none at finding solutions. I'll keep you posted every step. You're in great hands." }
    ],
    6: [
      { key: "prelim", label: "Preliminary Application", channel: "Text", msg: "It's application time. 📝 Your engineering letter, plan set, and required permits are underway across state, utility, and town. Applications process in sequence, utility before town, so thanks for your patience. We're tracking everything, and I'm here if you need anything. We're getting there." },
      { key: "utility_ok", label: "Utility Approved", channel: "Text", msg: "Happy day, [Customer]. Great news, we just got utility approval. 🙌 Now we're prepping your town permit application for [AHJ]. This part's in the town's hands, but we'll stay on it and keep you updated. One step closer. We got you. 👍" }
    ],
    7: [
      { key: "confirm_install", label: "Confirm Installation", channel: "Text", msg: "Hey [Customer], amazing news. 🎉 You're fully approved by the State, Town, and Utility, and we're ready to go. ✅ Now let's lock in your installation date. Give me a quick call or text me a couple of dates that work, and we'll line it up. I'll be there on install day to make sure it kicks off smoothly. 🙌" },
      { key: "install_day", label: "Install Day", channel: "Text", msg: "Congratulations. 🎉 Today's the day, welcome to the Trinity Solar family. Our crew will be on site between 8-9am, and I'll stop by around 11am to check in. Feel free to invite curious friends or neighbors to swing by. Any questions, call or text me. 📲" },
      { key: "referral", label: "Referral Reminder", channel: "Text", msg: "Quick reminder. 🚨 Now that you're part of the Trinity Solar family ☀️, you've unlocked our Friends and Family Referral Program: $1,000 for your first referral, $2,000 for every one after. Invite friends or family to your install day to see it up close. Let me know how many are coming, I'm buying lunch. 🥪" }
    ],
    8: [
      { key: "whats_to_come", label: "What's to Come", channel: "Text", msg: "Thanks again for making install day a pleasure. 🙌 Now that your panels are up, there's one final stretch: our QC team reviews the install, creates your system plaque, and preps for inspection. We'll reach out soon to coordinate a time for you, the inspector, and our electrician. Keep an eye out and be quick to confirm. Almost there. ⚡" }
    ],
    9: [
      { key: "on_to_pto", label: "On to PTO", channel: "Text", msg: "Woohoo. 🎉 You passed inspection. Next, the town issues a municipal release to the utility, who schedules your net meter install. Once we get the green light, Permission to Operate, I'll call you right away and swing by so we can flip the switch together. 🔌 So close." },
      { key: "meter_heads_up", label: "Net-Meter Heads-Up", channel: "Text", msg: "Quick heads-up [Customer]: the next step is the utility installing your new net meter. They schedule it themselves and usually show up unannounced, so don't worry if you see a meter swap you didn't book, that's a good sign. Once it's in, PTO is right behind it. 🔌" }
    ],
    10: [
      { key: "pto", label: "Permission to Operate", channel: "Call", msg: "(Call, not a text.) Your system has been approved to start generating clean solar electricity for your family! I'd love to come out to celebrate this moment with you. Thank you for being so patient, and congratulations!" },
      { key: "first_bill", label: "First-Bill Check-In", channel: "Text", msg: "Hey [Customer], a couple months in, how's everything feeling? I'd love to walk through your first bill so you can see the savings on paper. And if the experience has been a good one, a quick Google review means the world to us. 🌎" },
      { key: "long_checkin", label: "Long Check-In", channel: "Call/Text", msg: "Hey [Customer], checking in now that you've had the system a few months. Everything running well? If you know anyone, family, friends, neighbors, tired of their electric bill, I'd love to help them the way I helped you." }
    ]
  };

  // The primary (overdue-defining) touch per stage = the first one.
  window.DP_PRIMARY = { 4: "call24", 5: "engineering", 6: "prelim", 7: "confirm_install", 8: "whats_to_come", 9: "on_to_pto", 10: "pto" };
  window.DP_STAGE_LABEL = { 4: "Contracted", 5: "Engineering", 6: "Prelim", 7: "Installation", 8: "Inspection", 9: "Final App", 10: "Complete" };

  window.dtFirstName = function (c) {
    if (!c) return "there";
    let s = String(c).replace(/\s*-\s*.*$/, "").trim();
    if (s.includes(",")) { const p = s.split(","); s = (p[1] || p[0] || "").trim(); }
    else { s = s.split(" ")[0]; }
    return s.trim() || "there";
  };
  window.dtFillMsg = function (m, d) {
    return String(m || "")
      .replace(/\[Customer\]/g, window.dtFirstName(d.customer_name))
      .replace(/\[AHJ\]/g, (d.ahj_township || "your town").replace(/,.*$/, ""));
  };
  // The touch that's "due" for a deal at its current stage (the primary one).
  window.dtPrimaryTouch = function (stageNum) {
    const ts = window.DP_TOUCHES[stageNum];
    return ts && ts[0] ? ts[0] : null;
  };
})();
