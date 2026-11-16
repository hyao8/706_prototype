# Study plan (Step 4), draft

Task-based think-aloud study of prototype v0.1 with at least three classmates from other teams.
One team member moderates, another takes notes. No audio or video is recorded.

**Session length:** about 25 minutes.
**Setup:** participant's own laptop (screen 1280 px or wider), the public URL, no installation.

| Part | Time | What happens |
| --- | --- | --- |
| Introduction | 3 min | What Orphadata is (diseases, genes, clinical signs, specialties, prevalence), the three pages, the filter panel. Ask the participant to think aloud. No demo of the tasks. |
| Tasks | 17 min | The six tasks below, in order. The moderator reads each task and does not help unless the participant is stuck for about 2 minutes. |
| Open questions | 5 min | What worked, what was confusing, what is missing. |

## Tasks

Each task maps to one task from Step 2. Expected answers are for the July 2026 data with the default filters.

1. **(T1)** Which specialty has the most disorders? Which combination of specialties is the most common overlap?
   *Expected:* Developmental anomalies (2,141); Genetic + Neurologic (604).
2. **(T6)** Compare Neoplastic and Inborn errors of metabolism: which has the larger share of diseases with unknown or missing prevalence?
   *Expected:* reads the grey segments of the two prevalence bars.
3. **(T4)** A patient shows arachnodactyly, ectopia lentis and aortic root aneurysm. Which diseases are the best candidates, and why is the first one ranked first? Then keep only diseases where a sign is "very frequent" or more.
   *Expected:* Marfan syndrome, score 0.78, 3 of 3 signs; uses the minimum-frequency control.
4. **(T2)** Open Marfan syndrome. What is its prevalence class, typical age of onset and inheritance? What is the prevalence class based on?
   *Expected:* 1–5 / 10,000; all ages; autosomal dominant; point prevalence, worldwide.
5. **(T5)** Compare Marfan syndrome with two of the other candidates. Name two signs that tell them apart.
   *Expected:* reads the first columns of the sign comparison matrix.
6. **(T3)** Which diseases are linked to the gene FBN1, and in how many main specialties do they fall? Name one other gene that shares a disease with FBN1.
   *Expected:* 11 diseases; reads the gene–disease graph and the specialty bars.

## What we record, per participant and task

- Completed: yes / with help / no.
- Time on task (rough, from the note-taker's clock).
- Where the participant hesitated or made an error (which view, which control).
- Notable quotes, written down by the note-taker.
- After each task, one rating: "How easy was that?" from 1 (very hard) to 5 (very easy).

## Closing questions

- Which view was the most useful? Which was the hardest to read?
- Was it always clear what was selected and how to undo it?
- Was the candidate score understandable?
- What would you want this tool to do that it does not do?

## Analysis

Findings are summarized per task across participants (P1, P2, ...). Problems are ranked by how many participants
hit them and by severity (blocked the task / slowed it / cosmetic). The top problems drive the changes for the
final release.
