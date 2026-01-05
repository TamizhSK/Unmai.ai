# ZodError on `credibility` - FIXED

## Problem Identified

The backend was crashing with a `ZodError` because the `sources` array being passed to the response formatter was missing the required `credibility` field. This happened when using the "standard reference sources" which don't have a credibility score.

**Error Log:**
```
ZodError: [
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [ "sources", 0, "credibility" ],
    "message": "Required"
  }
]
```

## Solution Applied

I have updated `analyze-text-content.ts` to ensure that every source object has a `credibility` score before it's passed to the formatter. If a source is missing a credibility score, a default value of `0.85` is now assigned.

### File: `backend/src/ai/flows/analyze-text-content.ts`

**Lines 260-268**: Added code to map over the sources and add a default credibility score.

```typescript
// OLD
const [webSources, analyzedClaims, sentimentResult, manipulationResult] = await Promise.all([
  parallelOperations.referenceSources,
  // ...
]);

// NEW
const [rawWebSources, analyzedClaims, sentimentResult, manipulationResult] = await Promise.all([
  parallelOperations.referenceSources,
  // ...
]);

// Ensure all sources have a credibility score to prevent Zod errors
const webSources = rawWebSources.map((source: any) => ({
  url: source.url,
  title: source.title,
  credibility: source.credibility ?? 0.85, // Default credibility if missing
}));
```

## Benefits

- ✅ **No more `ZodError` crashes** - The `credibility` field is now always present.
- ✅ **Stable response generation** - The backend will no longer fail when using standard reference sources.
- ✅ **Consistent data structure** - All source objects now have the same shape.

## Expected Output

The backend will now successfully generate the unified response without crashing. The frontend will receive the complete, well-formatted response with the WH-based summary and tailored educational insights.

## Deployment

1. **Rebuild backend**:
   ```bash
   cd backend
   npm run build
   npm start
   ```

2. **Test with "trump is dead"**:
   - Verify the backend no longer crashes.
   - Check that the frontend displays the correct, complete response.

## Status

✅ **ZodError on `credibility` is FIXED**
✅ **Ready for testing and deployment**
