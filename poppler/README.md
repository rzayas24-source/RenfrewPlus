# Poppler Bundle Drop-In

Place the Windows Poppler binaries for this app in this folder, preserving their folder structure.

Expected layout:

```text
tools\poppler\Library\bin\pdfinfo.exe
tools\poppler\Library\bin\pdftoppm.exe
```

When you run [`build.ps1`](/C:/Renfrew/Workflow/build.ps1), it will copy this folder to the runtime root as `poppler\`, which is what the snapshot generator now looks for first.

If you already have Poppler packaged somewhere else, you can also use:

- `third_party\poppler`
- `vendor\poppler`

The backend will still fall back to a machine-installed Poppler path if no bundled copy is present.
