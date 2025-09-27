# Test Convention

1. Follow BDD best practices, tests should be outside in, describe behavior and use keywords such as 'should' to focus on desired system behavior.

2. For each test try implement as integration black box test. For example, send API to modify system state, then use another system API to verify the results.

3. To protect against false negatives: After adding a test, comment out the tested code and run it to make sure the test is failing as expected, then uncomment the code again and ensure the test now passes
