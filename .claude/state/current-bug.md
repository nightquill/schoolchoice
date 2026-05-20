# Bug under investigation

## Reported
Three bugs that keep recurring despite multiple fix attempts:
1. Can still delete students from the "All Students" default cohort — remove buttons still visible
2. Hardcoded English everywhere — cohort descriptions, status labels, various pages show English when locale is zh-HK
3. Student grade sandbox (grade builds) not visible on student dashboard page

Previous fixes claimed to work but user confirms they do NOT work in the actual browser.

## What I think they mean
My previous edits either didn't take effect (vite hot reload not picking up changes, or I edited wrong files), or the code paths I edited aren't the ones actually rendering in the browser. The user is seeing the OLD behavior despite my commits.

## How I will confirm I understood correctly
I will use Playwright to actually CLICK through each flow as each user type, take screenshots at each step, and READ every screenshot before proceeding. No assumptions about what the code does — only what the browser shows.

Bug 1: Login as admin → navigate to All Students cohort → check if remove buttons are visible
Bug 2: Login as admin (zh-HK locale) → navigate to multiple pages → check for any English text
Bug 3: Login as student → check if grade builds section is visible below programme choices
