/**
 * Runs every test case of the suite.
 *
 * @param {{ testcases: Array<{ name: string, steps: Array<{ url?: string, assertions?: unknown[] }> }> }} suite the parsed suite
 * @param {{ page: SuiteResponse, logout?: SuiteResponse }} responses the page the suite calls `target_site`, and the
 *   logout response it calls `target_site/logout_url` (cases that need it fail when none is given)
 * @returns {Array<{ name: string, pass: boolean, failed: string[] }>}
 */
export function runOshpSuite(suite: {
    testcases: Array<{
        name: string;
        steps: Array<{
            url?: string;
            assertions?: unknown[];
        }>;
    }>;
}, responses: {
    page: SuiteResponse;
    logout?: SuiteResponse;
}): Array<{
    name: string;
    pass: boolean;
    failed: string[];
}>;
export type SuiteResponse = {
    status: number;
    headers: Headers;
};
