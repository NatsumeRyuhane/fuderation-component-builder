Use DiagnosticDSL only when asked to test the component build or DSL runtime. It takes no parameters. Invoke exactly:
<$DiagnosticDSL$></$DiagnosticDSL$>
The user clicks Run checks. A completed assertion chain reports PASS; an interrupted chain stays RUNNING and reports an error toast. Visual checks remain manual.
