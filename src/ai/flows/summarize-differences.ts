'use server';

/**
 * @fileOverview A flow that summarizes the differences between two files.
 *
 * - summarizeDifferences - A function that summarizes the differences between two files.
 * - SummarizeDifferencesInput - The input type for the summarizeDifferences function.
 * - SummarizeDifferencesOutput - The return type for the summarizeDifferences function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeDifferencesInputSchema = z.object({
  primaryFileContent: z
    .string()
    .describe('The content of the file on the primary server.'),
  drFileContent: z.string().describe('The content of the file on the DR server.'),
});
export type SummarizeDifferencesInput = z.infer<
  typeof SummarizeDifferencesInputSchema
>;

const SummarizeDifferencesOutputSchema = z.object({
  summary: z
    .string()
    .describe(
      'A summary of the key differences between the files on the primary and DR servers.'
    ),
});
export type SummarizeDifferencesOutput = z.infer<
  typeof SummarizeDifferencesOutputSchema
>;

export async function summarizeDifferences(
  input: SummarizeDifferencesInput
): Promise<SummarizeDifferencesOutput> {
  return summarizeDifferencesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeDifferencesPrompt',
  input: {schema: SummarizeDifferencesInputSchema},
  output: {schema: SummarizeDifferencesOutputSchema},
  prompt: `You are an expert at identifying the differences between two files.

You will be provided with the content of two files, one from the primary server and one from the DR server.

You will summarize the key differences between the files.

Primary File Content:
{{primaryFileContent}}

DR File Content:
{{drFileContent}}`,
});

const summarizeDifferencesFlow = ai.defineFlow(
  {
    name: 'summarizeDifferencesFlow',
    inputSchema: SummarizeDifferencesInputSchema,
    outputSchema: SummarizeDifferencesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
