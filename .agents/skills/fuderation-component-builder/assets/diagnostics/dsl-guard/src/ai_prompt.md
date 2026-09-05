Use DiagnosticDSLGuard only when asked to test DSL assertion halting. It takes no parameters. Invoke exactly:
<$DiagnosticDSLGuard$></$DiagnosticDSLGuard$>
An EXPECTED rejection toast is intentional. Success means ARMED stays visible and NOT REACHED is unchanged. FAIL means execution wrongly continued. NOT RUN does not count as success.
