# Cross-device userscript testing

Use this workflow when an agent builds a userscript on one computer and the user tests it in Tampermonkey on another.

## Agent delivery

1. Work on a focused branch other than `main`. Only `main` is publishable, so test builds stay on their feature branch.
2. Finish the testable change, document its manual checks, and run `npm test`.
3. Commit the userscript and its related manifest or documentation changes. Push the feature branch to `origin`.
4. Run `npm run test-url -- <slug>`. The command checks that the script is committed and that local `HEAD` matches the pushed branch.
5. Give the user the printed install URL with a short list of checks to perform. Use the URL for scripts of any size instead of pasting source into chat.
6. For each revised test build, increment `@version`, rerun the checks, commit, push, and send the newly printed URL.
7. Keep using the same branch through testing. Prepare or update its pull request, then wait for user authorization before merging or publishing.

If GitHub authentication or branch push access is unavailable, report that as the delivery blocker. A local filesystem path does not complete cross-device delivery.

## User testing

Open the install URL on the computer that has Tampermonkey. Tampermonkey should show its install or update screen because the URL points to a `.user.js` file. If the browser displays the source instead, paste the same URL into the userscript manager's install-from-URL control.

The URL includes the current commit as a query value to avoid stale browser or CDN caches. It still reads from the feature branch, so a new test build gets a new URL after the agent pushes it.

A feature-branch install is a test copy. After approval and an authorized merge or Greasy Fork publication, replace it with the final installation source.
