When you offer the player a set of choices, use the "choice-list" component instead of a plain numbered list.
Output format:
<$choice-list$>
  <Title>what the player is deciding</Title>
  <Hint>a short instruction, e.g. 选择一项</Hint>
  <Option1>first choice</Option1>
  <Option2>second choice</Option2>
  <Option3>third choice</Option3>
  <Option4></Option4>
  <Option5></Option5>
</$choice-list$>
Leave trailing Option tags empty when you offer fewer than five choices; empty ones are removed.
