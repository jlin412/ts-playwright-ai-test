@regression @browse
Feature: Informational pages and navigation

    @smoke
    Scenario: Now playing page loads
        When I am on the now playing page
        Then the now playing page is loaded

    Scenario: Now playing page lists at least one movie
        When I am on the now playing page
        Then the now playing page is loaded
        And I see at least one movie listed

    Scenario: Coming soon page loads and displays its content
        When I am on the coming soon page
        Then the coming soon page is loaded
        And the coming soon page displays its content

    Scenario: Calendar page shows showtime content
        When I am on the calendar page
        Then the calendar page is loaded
        And the calendar shows showtime content

    Scenario: Membership page shows tiers and pricing
        When I am on the membership page
        Then the membership tiers are visible
        And the membership prices are displayed
        And the day pass option is visible

    Scenario: VR page shows flagship experience and technology
        When I am on the VR experience page
        Then the VR page shows the flagship experience
        And the VR page credits Bryan Cranston and mentions Positron technology

    Scenario: Our story page shows team members and media mentions
        When I am on the our story page
        Then the our story page shows team members
        And the our story page mentions media outlets

    Scenario: Contact page shows support information
        When I am on the contact page
        Then the contact page shows the support email and phone number

    Scenario: SHOWTIMES nav link navigates to the calendar page
        When I am on the home page
        Then the home page is loaded
        And clicking the SHOWTIMES nav link opens the calendar page

    Scenario: COMING SOON nav link navigates to the coming soon page
        When I am on the home page
        Then the home page is loaded
        And clicking the COMING SOON nav link opens the coming soon page
