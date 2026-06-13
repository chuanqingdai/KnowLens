# Image Generation Flow Regression Tests

This checklist covers the poster and PPT image generation flow. It focuses on state correctness, saved image recovery, retries, billing, and user-visible behavior.

## Scope

- Poster generation
- PPT generation
- PPT cover page generation
- Image task persistence
- Project image restoration
- Manual redraw / retry
- Credit checks and refunds
- Export readiness
- Failure UI

## Core Architecture Risks

1. Generation, asset persistence, credit billing, and UI recovery are not one atomic transaction.
2. PPT can create multiple image jobs for one project, especially after retrying one page.
3. Project restoration can accidentally return only the latest single-page job.
4. A later failed redraw can hide an older successfully persisted image.
5. Frontend polling or auto-trigger logic can overwrite a final failed state.
6. Third-party image generation can succeed while local/Blob asset persistence fails.
7. Export can become clickable before every slide image is ready.
8. Prompt payload can diverge from the Step 3 draft shown to the user.

## Automated Regression

Run:

```bash
npm run regression:image-state
```

This validates:

- All PPT pages are restored when the latest job only contains a retried page.
- A later failed redraw does not replace a previously persisted image during project restore.
- A page with no successful asset restores its latest failure state.
- Poster and PPT task states stay isolated by `intent`.

## Manual Test Matrix

### 1. Poster: single page success

Input:

```text
Make a one-page investor infographic about NVIDIA Q1 earnings.
```

Steps:

1. Choose `Generate Poster`.
2. Choose `1 poster`.
3. Confirm draft, style, and billing.
4. Wait until image generation completes.
5. Refresh the page.
6. Re-enter the project from Projects.

Expected:

- One poster image is displayed.
- The image remains visible after refresh.
- The project cover uses the generated image if project cover support is available.
- No generation error card appears in the conversation flow.
- Redraw button is available only after generation is no longer loading.

### 2. Poster: redraw success

Precondition:

- A poster image already exists.

Steps:

1. Click `Redraw`.
2. Confirm enough credits exist.
3. Wait until redraw completes.
4. Refresh the page.

Expected:

- Redraw charges one image generation unit.
- The new image replaces the active poster.
- The old image can remain in local history if history UI is enabled for redraw.
- Refresh restores the latest successful image.

### 3. Poster: redraw failure

Precondition:

- A poster image already exists.

Steps:

1. Force image generation failure through provider outage, bad mock, or disabled provider.
2. Click `Redraw`.
3. Wait until failure state is visible.
4. Refresh the page.

Expected:

- The previous successful image does not disappear.
- The failed redraw displays a concise failure message and an error code.
- Credits for the failed redraw are refunded.
- No automatic retry starts after the failure is visible.
- Manual retry is the only way to start another request.

### 4. PPT: requested count includes an independent cover

Input:

```text
Make a 6-slide PPT explaining how ocean currents work.
```

Steps:

1. Choose `Generate PPT`.
2. Choose `6 slides`.
3. Confirm draft.
4. Confirm style and billing.

Expected:

- Step 3 shows one independent cover plus 6 body pages.
- Billing charges 7 image pages.
- Slide canvas displays `Slide 1 / 7` through `Slide 7 / 7`.
- Cover content only shows the title in the draft.
- Cover image prompt includes the title and forbids small labels, notes, numbers, and dense text.

### 5. PPT: multi-page success and restore

Precondition:

- A PPT with cover plus multiple body pages has completed image generation.

Steps:

1. Refresh the workspace page.
2. Leave the project and reopen it from Projects.
3. Scroll through all slides.

Expected:

- Every generated slide image remains visible.
- No slide becomes blank while scrolling.
- Page content below each image maps to the correct Step 3 page content.
- No page number text such as `4/7` appears inside generated images by default.

### 6. PPT: one-page retry after previous pages succeeded

Precondition:

- Slides 1-10 are successfully generated.
- Slide 11 fails or is manually retried later.

Steps:

1. Retry only slide 11.
2. Wait until slide 11 succeeds.
3. Refresh the project.

Expected:

- Slides 1-10 remain visible.
- Slide 11 becomes visible.
- Project restore returns the latest persisted image per slide index, not only the latest job.

### 7. PPT: failed retry does not hide old successful slide

Precondition:

- Slide 3 has a successful image.

Steps:

1. Force the next redraw of slide 3 to fail.
2. Click `Redraw`.
3. Wait for failure.
4. Refresh the project.

Expected:

- Slide 3 still displays the previous successful image after refresh.
- Failure state is available only as retry feedback, not as a blank replacement for the saved slide.
- No automatic retry starts after the failure is visible.

### 8. PPT: export readiness

Precondition:

- A PPT has 7 total pages.

Steps:

1. Start image generation.
2. Try exporting while at least one image is still loading.
3. Try exporting while one image failed.
4. Export only after every image is `asset_ready`.

Expected:

- Export is disabled before all slide images are ready.
- Export modal does not show `Export ready` until all images are truly ready.
- Failure copy appears in the modal progress area, not as a noisy secondary panel.
- Download button appears only after export file creation succeeds.

### 9. Billing: not enough credits before generation

Steps:

1. Select a high-count PPT or poster option that costs more credits than the account balance.
2. Click billing confirm.

Expected:

- User stays in the conversation flow.
- Infinite canvas is not entered.
- A paywall dialog appears with polite English copy.
- No image generation job is created.
- No credits are deducted.

### 10. Billing: manual redraw requires credits

Precondition:

- Account has fewer than 6 credits.
- A generated image exists.

Steps:

1. Click `Redraw` or retry a failed image.

Expected:

- Credit sufficiency is checked before the request starts.
- Paywall dialog appears if credits are insufficient.
- No redraw job is created.

### 11. Provider fallback

Steps:

1. Simulate primary provider timeout.
2. Keep secondary provider configured.
3. Generate a PPT.

Expected:

- Primary provider timeout does not fail the entire batch immediately.
- Secondary provider is attempted.
- Successful pages are saved even if some pages fail.
- Failed pages require manual retry.
- Product UI does not expose internal provider names.

### 12. Asset persistence failure

Steps:

1. Simulate provider success with an image URL.
2. Simulate asset download/upload failure.

Expected:

- Task is marked failed with an asset persistence error code.
- Credits are refunded if product policy requires refund on final failure.
- Failure message tells the user to retry manually.
- Raw third-party URL is not the long-term project image source.
- Project restore uses only saved render URLs/assets.

### 13. Prompt-to-draft consistency

Steps:

1. Paste a long investor-oriented earnings text.
2. Generate one poster.
3. Compare Step 3 draft, image prompt payload, and final image.

Expected:

- Step 3 draft preserves the main facts and information units.
- Prompt3 does not include unrelated internal structure words.
- Final image uses information from the Step 3 draft and protected facts.
- No unrelated terms appear in the generated image.

### 14. UI failure message

Steps:

1. Force image generation failure.

Expected:

- Error card contains one concise sentence with a code.
- Suggested copy pattern:

```text
The image could not be generated right now; credits were refunded, please retry manually. Code: IMG-503.
```

- No internal provider platform names are shown.
- No duplicate error cards appear in the conversation flow.

## Release Gate

Before shipping changes to poster/PPT generation:

1. Run `npm run regression:image-state`.
2. Run `npx tsc --noEmit --incremental false`.
3. Manually verify one poster success and restore.
4. Manually verify one PPT success and restore.
5. Manually verify failed redraw does not hide a saved image.
6. Manually verify export is disabled until all PPT images are ready.
