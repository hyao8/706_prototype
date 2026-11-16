# Study plan (Step 4), draft

Task-based think-aloud study of prototype v0.1 with at least three classmates from other teams.
One team member moderates, another takes notes. No audio or video is recorded.

**Session length:** about 25 minutes.
**Setup:** participant's own laptop (screen 1280 px or wider), the public URL
(https://hyao8.github.io/706_prototype/), no installation. Every session starts from that address with the
default filters; **Reset** in the filter panel clears the filters, and **Clear all** in the selection bar clears
the selection.

| Part | Time | What happens |
| --- | --- | --- |
| Introduction | 3 min | What Orphadata is (diseases, genes, clinical signs, specialties, prevalence), the three pages, the filter panel. Ask the participant to think aloud. No demo of the tasks. The participant may open the in-app **Guide**; the note-taker records if and when they do. |
| Tasks | 17 min | The six tasks below, in order. The moderator reads each task and does not help unless the participant is stuck for about 2 minutes. |
| Open questions | 5 min | What worked, what was confusing, what is missing. |

## Tasks

Each task maps to one task from Step 2. Expected answers are for the July 2026 data with the default filters.

1. **(T1)** Which specialty has the most disorders? Which combination of specialties is the most common overlap?
   *Expected:* Developmental anomalies (2,141); Genetic + Neurologic (604).
2. **(T6)** Compare Neoplastic and Inborn errors of metabolism: which has the larger share of diseases with unknown or missing prevalence?
   *Expected:* Neoplastic (74.1% unknown or no record, against 19.4%); reads the grey segments of the two
   prevalence bars, or their tooltips.
3. **(T4)** A patient shows arachnodactyly, ectopia lentis and aortic root aneurysm. Which diseases are the best candidates, and why is the first one ranked first? Then keep only diseases where a sign is "very frequent" or more.
   *Expected:* Marfan syndrome, score 0.78, 3 of 3 signs (tied with Neonatal Marfan syndrome); explains the
   score from the three shaded squares. Then uses the minimum-frequency control: 106 candidates drop to 30, and
   Marfan syndrome falls to 2 of 3 signs (score 0.60). The participant sets the control back before the next task.
4. **(T2)** Open Marfan syndrome. What is its prevalence class, typical age of onset and inheritance? What is the prevalence class based on?
   *Expected:* 1–5 / 10,000; all ages; autosomal dominant; point prevalence, worldwide (shown under the class
   and in the source records).
5. **(T5)** Compare Marfan syndrome with two of the other candidates. Name two signs that tell them apart.
   *Expected:* ticks candidates in the list and uses the compare tray, or adds a suggested disease on the
   Disease page; reads the first columns of the sign comparison matrix.
6. **(T3)** Which diseases are linked to the gene FBN1, and in how many main specialties do they fall? Name one other gene that shares a disease with FBN1.
   *Expected:* 11 diseases in 5 main specialties; another gene such as LTBP3, ACTA2 or ADAMTS10. Reads the key
   facts, the gene–disease graph (or its matrix view) and the specialty bars.

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
