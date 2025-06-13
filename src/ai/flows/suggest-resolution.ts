'use server';

/**
 * @fileOverview AI-powered conflict resolution assistant for file discrepancies.
 *
 * - suggestResolution - A function that suggests resolutions for file differences.
 * - SuggestResolutionInput - The input type for the suggestResolution function.
 * - SuggestResolutionOutput - The return type for the suggestResolution function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestResolutionInputSchema = z.object({
  primaryServerFilePath: z
    .string()
    .describe('The file path on the primary server.'),
  drServerFilePath: z
    .string()
    .describe('The file path on the DR server.'),
  fileDifferenceDetails: z
    .string()
    .describe('Detailed information about the differences between the files.'),
});
export type SuggestResolutionInput = z.infer<typeof SuggestResolutionInputSchema>;

const SuggestResolutionOutputSchema = z.object({
  resolutionSuggestion: z
    .string()
    .describe('An AI-powered suggestion for resolving the file discrepancy.'),
  confidenceLevel: z
    .string()
    .describe('The AI models confidence level in its suggestion.'),
});
export type SuggestResolutionOutput = z.infer<typeof SuggestResolutionOutputSchema>;

export async function suggestResolution(input: SuggestResolutionInput): Promise<SuggestResolutionOutput> {
  return suggestResolutionFlow(input);
}

const suggestResolutionPrompt = ai.definePrompt({
  name: 'suggestResolutionPrompt',
  input: {schema: SuggestResolutionInputSchema},
  output: {schema: SuggestResolutionOutputSchema},
  prompt: `You are an AI assistant that analyzes file differences between a primary and DR server, and suggests a resolution.

  Here are the details of the file differences:
  {{{fileDifferenceDetails}}}

  Based on the file differences between primary server file path {{{primaryServerFilePath}}} and DR server file path {{{drServerFilePath}}}, provide a detailed suggestion for resolving the conflict, and a confidence level in your suggestion.
  `,}
);

const suggestResolutionFlow = ai.defineFlow(
  {
    name: 'suggestResolutionFlow',
    inputSchema: SuggestResolutionInputSchema,
    outputSchema: SuggestResolutionOutputSchema,
  },
  async input => {
    const {output} = await suggestResolutionPrompt(input);
    return output!;
  }
);
