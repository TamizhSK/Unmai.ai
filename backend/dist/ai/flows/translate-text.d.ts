export declare const translateTextFlow: (input: {
    text: string;
    targetLanguage: string;
}) => Promise<string>;
export declare const detectLanguageFlow: (text: string) => Promise<{
    language: string;
    confidence: number;
}>;
//# sourceMappingURL=translate-text.d.ts.map