@trace-viewer-test
Feature: Intentional failure — trace viewer demo

    Scenario: Intentionally failing — PAY button does not exist on the home page
        When I am on the home page
        Then the PAY button is disabled
