import type { DocsPage } from './types';

/** English guide bodies for Hub Docs v1. */
export const DOCS_PAGES: DocsPage[] = [
  {
    slug: 'get-started/overview',
    title: 'Overview',
    lead: 'House Pros Hub helps pros run the business and helps homeowners find trusted local pros. This guide shows you how to use the Hub day to day.',
    sections: [
      {
        id: 'what-is-the-hub',
        title: 'What is the Hub',
        paragraphs: [
          'Pros use the CRM for contacts, estimates, invoices, projects, calendar, and expenses. ProBot answers questions from that data and opens the right screens.',
          'Homeowners browse pros, request estimates, message businesses, and keep home records in My Places.',
        ],
      },
      {
        id: 'where-to-start',
        title: 'Where to start',
        steps: [
          'Create an account and choose a personal or business profile.',
          'Pros: open ProBot or CRM and add your first contact.',
          'Homeowners: search the directory or request a free estimate.',
        ],
        links: [
          { label: 'Open ProBot', href: '/probot' },
          { label: 'Browse pros', href: '/businesslist' },
        ],
      },
    ],
  },
  {
    slug: 'get-started/create-account',
    title: 'Create your account',
    lead: 'Sign up once. You can add a business profile later without making a second login.',
    sections: [
      {
        id: 'sign-up',
        title: 'Sign up',
        steps: [
          'Open Sign in from the account menu.',
          'Create an account with email or Google.',
          'Finish your name and location when the Hub asks for them.',
        ],
        links: [{ label: 'Sign in', href: '/signin' }],
      },
      {
        id: 'after-you-join',
        title: 'After you join',
        paragraphs: [
          'Personal profiles are for homeowners. Business profiles unlock ProsCRM, ProBot business tools, and your public pro card.',
        ],
      },
    ],
  },
  {
    slug: 'get-started/business-vs-personal',
    title: 'Business vs personal',
    lead: 'Switch profiles from the account menu when you need homeowner tools or pro tools.',
    sections: [
      {
        id: 'personal',
        title: 'Personal',
        paragraphs: [
          'Use personal for My Places, finding pros, estimates as a homeowner, and chatting with businesses.',
        ],
        links: [{ label: 'My Places', href: '/myplaces' }],
      },
      {
        id: 'business',
        title: 'Business',
        paragraphs: [
          'Use business for CRM, ProBot with your books, estimates and invoices you send, and your public listing.',
        ],
        links: [
          { label: 'ProsCRM contacts', href: '/crm/customers' },
          { label: 'ProBot', href: '/probot' },
        ],
      },
    ],
  },
  {
    slug: 'probot/chat',
    title: 'Chat with ProBot',
    lead: 'ProBot is your Hub assistant. Ask about customers, money, schedule, or projects in plain language.',
    sections: [
      {
        id: 'ask-a-question',
        title: 'Ask a question',
        steps: [
          'Open ProBot from the account menu or the ProBot chat.',
          'Type in Ask ProBot, or pick a CRM shortcut on the welcome screen.',
          'Read the answer and use the page button under it (Contacts, Invoices, and so on) to open the full list.',
        ],
        links: [{ label: 'Open ProBot', href: '/probot' }],
      },
      {
        id: 'what-probot-uses',
        title: 'What ProBot uses',
        paragraphs: [
          'Answers come from your CRM data for the active business profile. Counts and names match Contacts, Invoices, Estimates, Projects, Calendar, and Maintenance.',
        ],
      },
    ],
  },
  {
    slug: 'probot/voice',
    title: 'Voice notes',
    lead: 'Talk to ProBot when your hands are busy. The reply shows when the voice note is ready.',
    sections: [
      {
        id: 'send-a-voice-note',
        title: 'Send a voice note',
        steps: [
          'Tap the microphone on the Ask ProBot bar.',
          'Speak your question, then send.',
          'Wait for the reply bubble and player together — text and audio arrive at the same time.',
        ],
      },
      {
        id: 'tips',
        title: 'Tips',
        paragraphs: [
          'Keep questions short. Ask for a count, who owes money, or what is on the schedule today.',
        ],
      },
    ],
  },
  {
    slug: 'probot/welcome-shortcuts',
    title: 'CRM shortcuts on welcome',
    lead: 'On an empty ProBot chat, shortcut boxes open CRM tools without typing a question.',
    sections: [
      {
        id: 'available-shortcuts',
        title: 'Available shortcuts',
        paragraphs: [
          'Calendar, Contacts, Estimates, Invoices, Projects, Expenses, Add Task, and Add a customer sit under the greeting when you use a business profile.',
        ],
        steps: [
          'Open ProBot with no messages in the thread.',
          'Tap a shortcut box to open that CRM view.',
          'Use Back to return to the welcome screen, or ask ProBot in the bar below.',
        ],
        links: [{ label: 'Open ProBot', href: '/probot' }],
      },
    ],
  },
  {
    slug: 'crm/contacts',
    title: 'Contacts',
    lead: 'Contacts are the people and companies in your CRM. Customers are contacts with the Customer role.',
    sections: [
      {
        id: 'open-contacts',
        title: 'Open Contacts',
        steps: [
          'Go to ProsCRM → Contacts, or ask ProBot how many customers you have and open the Contacts button.',
          'Search or filter the list.',
          'Open a card to edit details, roles, and linked work.',
        ],
        links: [{ label: 'Contacts', href: '/crm/customers' }],
      },
      {
        id: 'add-a-contact',
        title: 'Add a contact',
        steps: [
          'Use Add a customer from ProBot welcome, or add from Contacts.',
          'Enter name and details, then save.',
        ],
      },
    ],
  },
  {
    slug: 'crm/estimates',
    title: 'Estimates',
    lead: 'Build estimates, send them to customers, and track which ones are still waiting.',
    sections: [
      {
        id: 'work-with-estimates',
        title: 'Work with estimates',
        steps: [
          'Open Estimates in ProsCRM.',
          'Create or edit a draft, then send it.',
          'Ask ProBot which estimates are waiting for an answer when you need a quick list.',
        ],
        links: [{ label: 'Estimates', href: '/crm/estimates' }],
      },
    ],
  },
  {
    slug: 'crm/invoices',
    title: 'Invoices',
    lead: 'Send invoices, track balances, and see who still owes you.',
    sections: [
      {
        id: 'open-invoices',
        title: 'Open invoices',
        steps: [
          'Open Invoices in ProsCRM.',
          'Create an invoice from a job or from scratch.',
          'Ask ProBot who owes you money to hear open balances, then open the Invoices page button.',
        ],
        links: [{ label: 'Invoices', href: '/crm/invoices' }],
      },
    ],
  },
  {
    slug: 'crm/projects',
    title: 'Projects',
    lead: 'Projects track jobs from start date through finish.',
    sections: [
      {
        id: 'track-projects',
        title: 'Track projects',
        steps: [
          'Open Projects in ProsCRM.',
          'Set start and end dates so the schedule and ProBot can answer “what finishes this week.”',
          'Link the customer so invoices and visits stay tied to the right job.',
        ],
        links: [{ label: 'Projects', href: '/crm/projects' }],
      },
    ],
  },
  {
    slug: 'crm/calendar',
    title: 'Calendar & schedule',
    lead: 'See appointments, estimate visits, maintenance, and project days in one place.',
    sections: [
      {
        id: 'use-the-calendar',
        title: 'Use the calendar',
        steps: [
          'Open Calendar in ProsCRM or from ProBot shortcuts.',
          'Ask ProBot what is on your schedule today or tomorrow.',
          'Add visits and tasks so the day board stays current.',
        ],
        links: [{ label: 'Calendar', href: '/crm/calendar' }],
      },
    ],
  },
  {
    slug: 'crm/expenses',
    title: 'Expenses',
    lead: 'Log materials and job costs so your books stay close to the field.',
    sections: [
      {
        id: 'log-expenses',
        title: 'Log expenses',
        steps: [
          'Open Expenses from ProsCRM or ProBot shortcuts.',
          'Add vendor, amount, date, and category.',
          'Attach a receipt when you have one.',
        ],
        links: [{ label: 'Expenses', href: '/crm/expenses' }],
      },
    ],
  },
  {
    slug: 'homeowners/find-a-pro',
    title: 'Find a pro',
    lead: 'Browse local pros by trade, search, or category.',
    sections: [
      {
        id: 'browse-the-directory',
        title: 'Browse the directory',
        steps: [
          'Open the business list from the Hub home.',
          'Filter by category or search by name.',
          'Open a pro card to message them or request an estimate.',
        ],
        links: [{ label: 'Find pros', href: '/businesslist' }],
      },
    ],
  },
  {
    slug: 'homeowners/request-estimate',
    title: 'Request an estimate',
    lead: 'Tell pros what you need. They reply with pricing and next steps.',
    sections: [
      {
        id: 'request-steps',
        title: 'Request an estimate',
        steps: [
          'Tap Free Estimate in the menu or on a pro card.',
          'Describe the project, location, and timeline.',
          'Submit and watch for replies in chat.',
        ],
        links: [{ label: 'Free estimate', href: '/estimate' }],
      },
    ],
  },
  {
    slug: 'homeowners/my-places',
    title: 'My Places',
    lead: 'Keep each property’s plans, documents, and history in one spot.',
    sections: [
      {
        id: 'use-my-places',
        title: 'Use My Places',
        steps: [
          'Open My Places from the account menu (personal profile).',
          'Add a property and upload photos or files as you collect them.',
          'Share a place into chat when you message a pro.',
        ],
        links: [{ label: 'My Places', href: '/myplaces' }],
      },
    ],
  },
];
