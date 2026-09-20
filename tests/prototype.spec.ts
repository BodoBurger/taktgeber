import { expect, test, type Page } from "@playwright/test";

async function setupShortWorkout(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Make it your own" }).click();
  await page.getByLabel("Work (seconds)").fill("5");
  await page.getByLabel("Rest (seconds)").fill("5");
  await page.getByLabel("Rounds", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Mute sounds", exact: true }).click();
}

test("manual completion records reps, weight, notes and offline history", async ({
  page,
  context,
}) => {
  await page.clock.install();
  await setupShortWorkout(page);
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.clock.runFor(15100);
  await expect(
    page.getByRole("heading", { name: "Dumbbell rows", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Actual reps / side").fill("8");
  await page.getByLabel("Weight per dumbbell (kg)").fill("12.5");
  await page.getByLabel("A note for this exercise").fill("Steady pace today");
  await page.getByRole("button", { name: "Done with this set" }).click();
  await page.clock.runFor(10100);
  await expect(
    page.getByRole("heading", { name: "You found your rhythm." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View session" }).click();
  await page.locator(".history-item summary").click();
  await expect(
    page.getByText("8 reps / side · 12.5 kg per dumbbell"),
  ).toBeVisible();
  await expect(page.getByText("Steady pace today")).toBeVisible();
  await expect(page.getByText("3 completed sets")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByText("3 completed sets")).toBeVisible();
  await page.locator(".history-item summary").click();
  await expect(page.getByText("Steady pace today")).toBeVisible();
});

test("reload recovers timestamp state; pause remains paused across reload", async ({
  page,
}) => {
  await page.clock.install();
  await setupShortWorkout(page);
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.clock.runFor(6100);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const before = await page.getByRole("timer").textContent();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.clock.runFor(30000);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("timer")).toHaveText(before!);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.clock.fastForward(20000);
  await expect(
    page.getByRole("heading", { name: "Dumbbell rows", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Done with this set" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Dumbbell rows", exact: true }),
  ).toBeVisible();
});

test("mobile layout fits and skipped sets are excluded from history", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install();
  await setupShortWorkout(page);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.clock.runFor(5100);
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByRole("button", { name: "Finish early" }).click();
  await page
    .getByRole("button", { name: "Finish session", exact: true })
    .click();
  await page.getByRole("button", { name: "View session" }).click();
  await expect(page.getByText("0 completed sets")).toBeVisible();
  await page.locator(".history-item summary").click();
  await expect(
    page.getByText("No confirmed exercises in this session yet."),
  ).toBeVisible();
});

test("small phone timer fits, and audio can be enabled by a tap", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  const dial = await page.locator(".timer-dial").boundingBox();
  const card = await page.locator(".timer-card").boundingBox();
  expect(dial!.x).toBeGreaterThanOrEqual(card!.x);
  expect(dial!.x + dial!.width).toBeLessThanOrEqual(card!.x + card!.width);
  await page.getByRole("button", { name: "Test sound", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Device check" })
    .click();
  await expect(
    page.locator(".device-status").getByText("running", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("delayed timers require review and do not invent manual results", async ({
  page,
}) => {
  await page.clock.install();
  await setupShortWorkout(page);
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.clock.fastForward(60000);
  await expect(
    page.getByRole("heading", { name: "Dumbbell rows", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Finish early" }).click();
  await page
    .getByRole("button", { name: "Finish session", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A quick check-in" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await page.getByRole("button", { name: "View session" }).click();
  await expect(page.getByText("1 completed sets")).toBeVisible();
});
