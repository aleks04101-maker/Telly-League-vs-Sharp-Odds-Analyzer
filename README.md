# Telly League vs Sharp Odds — Web prototype

A mobile-friendly browser version of the Python app's core manual-entry, LUT, regression, and comparison workflow.

## Run locally on Windows

1. Download and extract the project ZIP.
2. Open `index.html` in a modern browser (Edge or Chrome is fine).
3. Import your existing `lut_data.csv` using **Import CSV**.
4. Add historical rows or enter current matches and select **Compare Odds**.

No installation or server is required for local testing. For iPhone Safari, the app must be hosted on an HTTPS site; opening the local file from Windows does not make it available on your iPhone. GitHub Pages is a straightforward free hosting option.

## Features in this first version

- Responsive layout designed for desktop and iPhone Safari.
- Four match-entry cards with Telly home/away costs and Sharp 1/X/2 odds.
- LUT import/export using the Python app's five-column CSV layout.
- Local browser storage, plus clear-LUT and clear-input controls.
- Normalized Sharp probabilities, degree-2 least-squares regression, price comparison, and EV calculation.
- Regression plot of historical favorite probability against Telly cost.

## Important notes

- OCR/photo recognition is not included in this first version; manual entry is available now. It can be added after the core workflow is tested.
- Browser storage is separate on each device/browser. Export the CSV on one device and import it on the other to transfer data.
- The app expects exactly one positive Telly cost per row (home or away); the other side should be blank or zero, matching the original app's favorite-selection approach.
- The quadratic model requires at least three distinct Telly costs. The Python version may produce a fit with insufficient data but can be unstable; this prototype displays a warning instead.
- The regression uses a numerically scaled least-squares fit intended to match the Python app's degree-2 model. Verify a few cases against the original Python app before relying on results.
