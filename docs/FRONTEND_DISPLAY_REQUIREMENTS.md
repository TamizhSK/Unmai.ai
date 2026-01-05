# Frontend Display Requirements - Response Card Updates

## Current Issue

The response card is NOT displaying:
1. ❌ `oneLineDescription` - Currently missing from UI
2. ❌ `summary` (informationSummary) - Shows placeholder or generic text
3. ❌ `educationalInsight` - Shows placeholder or generic text

## Required Changes

### 1. Display oneLineDescription

**Location**: Below the mainLabel badge, before the summary

**Current Code** (in unified-response-card.tsx):
```typescript
<div className="space-y-1 border-b border-border pb-3">
  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{translate('card.heading.description')}</h3>
  <p className="text-foreground text-sm leading-relaxed break-words whitespace-pre-wrap text-justify">
    {sanitizeText(data.oneLineDescription) || translate('card.placeholder.noDescription')}
  </p>
</div>
```

**Status**: ✅ Already implemented, just needs to be verified it's displaying

**Verification**:
- Check that `data.oneLineDescription` is being passed from backend
- Verify it's not empty or showing placeholder
- Ensure it displays: "High-risk text content detected with 1 disputed claim"

---

### 2. Display Summary (informationSummary) - WH-Based

**Location**: Main content area, after oneLineDescription

**Current Code** (in unified-response-card.tsx):
```typescript
<div className="space-y-2 border-b border-border pb-3">
  <h3 className="text-xs sm:text-sm font-medium text-muted-foreground uppercase">{translate('card.heading.summary')}</h3>
  <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap break-words text-justify">
    {sanitizeText(data.informationSummary) || translate('card.placeholder.noSummary')}
  </p>
</div>
```

**Status**: ✅ Already implemented, but showing placeholder

**Issue**: `data.informationSummary` is empty or showing placeholder

**Fix Required**:
- Verify backend is sending `summary` field
- Map backend `summary` to frontend `informationSummary`
- Ensure it displays full WH-based content:
  ```
  What: The content claims "trump is dead". 
  Why it's problematic: The claim contradicts verified information and lacks credible evidence. 
  How it manipulates: Uses techniques like death hoax and emotional manipulation to influence perception. 
  Emotional impact: Designed to trigger fear and shock responses. 
  This content is HIGH RISK and likely contains false or misleading information designed to deceive.
  ```

---

### 3. Display Educational Insight - Protection/Prevention

**Location**: Expandable section (Accordion), after summary

**Current Code** (in unified-response-card.tsx):
```typescript
<Accordion type="single" collapsible className="border-b border-border">
  <AccordionItem value="educational" className="border-0">
    <AccordionTrigger className="text-xs sm:text-sm font-medium text-muted-foreground py-2 hover:no-underline uppercase">
      {translate('card.heading.educational')}
    </AccordionTrigger>
    <AccordionContent>
      {data.educationalInsight && (
        <div className="p-3 bg-muted/50 rounded-lg text-sm leading-relaxed">
          <p className="whitespace-pre-wrap break-words text-foreground text-justify">{sanitizeText(data.educationalInsight)}</p>
          {/* ... other content ... */}
        </div>
      )}
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

**Status**: ✅ Already implemented, but showing placeholder

**Issue**: `data.educationalInsight` is empty or showing placeholder

**Fix Required**:
- Verify backend is sending `educationalInsight` field
- Ensure it displays full protection/prevention content:
  ```
  PROTECT YOURSELF: This is high-risk misinformation. Do not share without verification. Before believing or sharing: (1) Check the source's credibility and track record, (2) Look for corroboration from at least 3 independent authoritative sources, (3) Check the publication date to ensure it's current and not recycled old information.

  RECOGNIZE THE MANIPULATION: This content uses "death hoax", "emotional manipulation", "sensationalism" techniques. Watch for: Sensational headlines, emotional language, lack of sources, appeals to fear or anger, and claims that seem too good/bad to be true.

  PREVENT FALLING FOR THIS: When reading text claims: (1) Pause before sharing - take time to verify, (2) Check the author's credentials and potential bias, (3) Look for citations and sources, (4) Ask yourself "Is this trying to make me angry or afraid?" - that's often a red flag.

  NEXT STEPS: If you've already shared this content, consider: (1) Editing your post to add a correction or fact-check link, (2) Sharing the fact-check with people who may have seen your original post, (3) Learning more about media literacy to spot similar content in the future.
  ```

---

## Backend Response Mapping

### Current Frontend Mapping (in server.ts):
```typescript
const transformedResult = {
  mainLabel: type.charAt(0).toUpperCase() + type.slice(1),
  oneLineDescription: result.oneLineDescription && result.oneLineDescription.trim() ? result.oneLineDescription : 'Analysis complete.',
  informationSummary: result.summary && result.summary.trim() ? result.summary : 'No summary available',
  educationalInsight: result.educationalInsight && result.educationalInsight.trim() ? result.educationalInsight : 'No specific educational insight provided.',
  // ... rest of fields
};
```

**Status**: ✅ Mapping looks correct

**Verification**:
- Check that `result.oneLineDescription` is not empty
- Check that `result.summary` is not empty
- Check that `result.educationalInsight` is not empty
- If any are empty, the fallback placeholders will be used

---

## Debugging Steps

### Step 1: Check Backend Response
Add logging to server.ts to verify fields are present:

```typescript
console.log('[DEBUG] Backend response fields:');
console.log(`  - oneLineDescription: "${result.oneLineDescription}" (${result.oneLineDescription?.length || 0} chars)`);
console.log(`  - summary: "${result.summary}" (${result.summary?.length || 0} chars)`);
console.log(`  - educationalInsight: "${result.educationalInsight}" (${result.educationalInsight?.length || 0} chars)`);
```

### Step 2: Check Frontend Receives Data
Add logging to dynamic-analysis-result.tsx:

```typescript
console.log('[DEBUG] Frontend received:');
console.log(`  - oneLineDescription: "${data.oneLineDescription}"`);
console.log(`  - informationSummary: "${data.informationSummary}"`);
console.log(`  - educationalInsight: "${data.educationalInsight}"`);
```

### Step 3: Check Response Card Renders
Add logging to unified-response-card.tsx:

```typescript
console.log('[DEBUG] Response card rendering:');
console.log(`  - oneLineDescription: "${sanitizeText(data.oneLineDescription)}"`);
console.log(`  - informationSummary: "${sanitizeText(data.informationSummary)}"`);
console.log(`  - educationalInsight: "${sanitizeText(data.educationalInsight)}"`);
```

---

## Expected Output for "trump is dead"

### Backend Response:
```json
{
  "oneLineDescription": "High-risk text content detected with 1 disputed claim",
  "informationSummary": "What: The content claims \"trump is dead\". Why it's problematic: The claim contradicts verified information and lacks credible evidence. How it manipulates: Uses techniques like death hoax and emotional manipulation to influence perception. Emotional impact: Designed to trigger fear and shock responses. This content is HIGH RISK and likely contains false or misleading information designed to deceive.",
  "educationalInsight": "PROTECT YOURSELF: This is high-risk misinformation... [full text]"
}
```

### Frontend Display:
```
┌──���──────────────────────────────────────┐
│ Text                                    │
├─────────────────────────────────────────┤
│ Description:                            │
│ High-risk text content detected with    │
│ 1 disputed claim                        │
├─────────────────────────────────────────┤
│ Information Summary:                    │
│ What: The content claims "trump is      │
│ dead". Why it's problematic: The claim  │
│ contradicts verified information and    │
│ lacks credible evidence. How it         │
│ manipulates: Uses techniques like death │
│ hoax and emotional manipulation to      │
│ influence perception. Emotional impact: │
│ Designed to trigger fear and shock      │
│ responses. This content is HIGH RISK    │
│ and likely contains false or misleading │
│ information designed to deceive.        │
├─────────────────────────────────────────┤
│ ▼ Insight: Protection & Prevention      │
│   PROTECT YOURSELF: This is high-risk   │
│   misinformation. Do not share without  │
│   verification. Before believing or     │
│   sharing: (1) Check the source's       │
│   credibility and track record, (2)     │
│   Look for corroboration from at least  │
│   3 independent authoritative sources,  │
│   (3) Check the publication date to     │
│   ensure it's current and not recycled  │
│   old information.                      │
│                                         │
│   RECOGNIZE THE MANIPULATION: This      │
│   content uses "death hoax",            │
│   "emotional manipulation",             │
│   "sensationalism" techniques. Watch    │
│   for: Sensational headlines, emotional │
│   language, lack of sources, appeals to │
│   fear or anger, and claims that seem   │
│   too good/bad to be true.              │
│                                         │
│   PREVENT FALLING FOR THIS: When        │
│   reading text claims: (1) Pause before │
│   sharing - take time to verify, (2)    │
│   Check the author's credentials and    │
│   potential bias, (3) Look for          │
│   citations and sources, (4) Ask        │
│   yourself "Is this trying to make me   │
│   angry or afraid?" - that's often a    │
│   red flag.                             │
│                                         │
│   NEXT STEPS: If you've already shared  │
│   this content, consider: (1) Editing   │
│   your post to add a correction or      │
│   fact-check link, (2) Sharing the      │
│   fact-check with people who may have   │
│   seen your original post, (3) Learning │
│   more about media literacy to spot     │
│   similar content in the future.        │
├─────────────────────────────────────────┤
│ Verdict: Fake                           │
│ Sources: 3 sources (Snopes, FactCheck,  │
│ PolitiFact)                             │
└─────────────────────────────────────────┘
```

---

## Checklist for Frontend Implementation

- [ ] Verify `oneLineDescription` is displayed (should show "High-risk text content detected with 1 disputed claim")
- [ ] Verify `informationSummary` displays WH-based content (not generic placeholder)
- [ ] Verify `educationalInsight` displays protection/prevention advice (not generic placeholder)
- [ ] Check that all three fields are non-empty for "trump is dead" input
- [ ] Verify no placeholder strings are shown ("No description available", "No summary available", etc.)
- [ ] Test with multiple inputs to ensure consistency
- [ ] Check browser console for any errors or warnings
- [ ] Verify response card layout accommodates longer text content

---

## Summary

The backend is now providing:
1. ✅ **oneLineDescription** - Specific, concise description
2. ✅ **summary** (informationSummary) - WH-based about the input
3. ✅ **educationalInsight** - Tailored protection/prevention advice

The frontend needs to:
1. ✅ Display all three fields (code already exists)
2. ⚠️ Verify they're receiving non-empty values from backend
3. ⚠️ Ensure no placeholders are masking the content

**Status**: Ready for frontend verification and testing
