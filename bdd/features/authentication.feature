@regression @auth
Feature: Authentication flow

    Background:
        Given I am on the now playing page
        When I select a movie that has scheduled showtimes
        And I pick the first available showtime
        Then the checkout showing page is loaded with all tabs

    @smoke
    Scenario: Login form shows all required fields on the Tickets tab
        Then the login form is visible with all required fields

    Scenario: Wrong credentials shows an error and keeps the form open
        When I log in with email "nobody@example.com" and password "BadPassword999!"
        Then an invalid credentials error is shown
        And the login form is still visible

    Scenario: Forgot Password link navigates to the password reset page
        When I click the Forgot Password link
        Then I am on the password reset page
