import type { DocsPage } from './types';

/** Story-style Hub Docs: ProBot plays each part. */
export const DOCS_PAGES: DocsPage[] = [
  {
    slug: 'get-started/overview',
    title: 'Overview',
    lead: 'Meet ProBot. In these guides he tries on every hat — owner, customer, plumber, crew — so you can see how the Hub fits your day.',
    heroRole: 'guide',
    sections: [
      {
        id: 'two-sides',
        title: 'Two sides of the Hub',
        role: 'guide',
        roleLabel: 'ProBot the guide',
        story:
          '“Think of me as the office kid who also walks the job. On one side I help pros run Contacts, Estimates, Invoices, Projects, Calendar, and Expenses. On the other I help homeowners find a pro, request an estimate, and keep My Places tidy. Same Hub — different hats.”',
        links: [
          { label: 'Open ProBot', href: '/probot' },
          { label: 'Browse pros', href: '/businesslist' },
        ],
      },
      {
        id: 'where-to-start',
        title: 'Where to start',
        role: 'crew',
        roleLabel: 'ProBot on day one',
        story:
          '“Day one is simple. Make an account. If you run a trade, switch to your business profile and say hi to me in ProBot. If you own a home, stay on personal, peek at My Places, or ask for a free estimate. I’ll meet you where you are.”',
        steps: [
          'Create an account (email or Google).',
          'Pros: open ProBot or CRM and add a contact.',
          'Homeowners: browse pros or request an estimate.',
        ],
      },
    ],
  },
  {
    slug: 'get-started/create-account',
    title: 'Create your account',
    lead: 'ProBot walks you through the front door — one login, then personal or business when you need it.',
    heroRole: 'guide',
    sections: [
      {
        id: 'sign-up',
        title: 'Walk in and sign up',
        role: 'customer',
        roleLabel: 'ProBot at the door',
        story:
          '“I hold the door. Tap Sign in, pick email or Google, and tell the Hub your name and where you work from. You only do this once — after that I’m waiting in the chat.”',
        steps: [
          'Open Sign in from the account menu.',
          'Create an account with email or Google.',
          'Finish name and location when asked.',
        ],
        links: [{ label: 'Sign in', href: '/signin' }],
      },
      {
        id: 'after-you-join',
        title: 'After you join',
        role: 'business',
        roleLabel: 'ProBot with two badges',
        story:
          '“Personal is for home stuff. Business unlocks ProsCRM, my business tools, and your public pro card. Flip between them in the account menu — I change hats with you.”',
      },
    ],
  },
  {
    slug: 'get-started/business-vs-personal',
    title: 'Business vs personal',
    lead: 'Same ProBot. Different jobs. Here’s how he shows up on each profile.',
    heroRole: 'business',
    sections: [
      {
        id: 'personal',
        title: 'Personal profile',
        role: 'customer',
        roleLabel: 'ProBot the homeowner',
        story:
          '“On personal I’m in jeans with a house key. I talk My Places, finding pros, estimates for your home, and chats with businesses. Bills on your house live on your places — ask me there.”',
        links: [{ label: 'My Places', href: '/myplaces' }],
      },
      {
        id: 'business',
        title: 'Business profile',
        role: 'business',
        roleLabel: 'ProBot the owner',
        story:
          '“On business I’ve got the clipboard. Jobs, customers, estimates you send, invoices, schedule, crew. Ask who owes you money or what’s on the calendar — I’ll look it up for real.”',
        links: [
          { label: 'Contacts', href: '/crm/customers' },
          { label: 'ProBot', href: '/probot' },
        ],
      },
    ],
  },
  {
    slug: 'probot/chat',
    title: 'Chat with ProBot',
    lead: 'ProBot as office manager: plain questions, real CRM answers, and a button to the right page.',
    heroRole: 'guide',
    sections: [
      {
        id: 'ask-a-question',
        title: 'Ask like you’re on the phone',
        role: 'business',
        roleLabel: 'ProBot at the desk',
        story:
          '“Open me from the account menu. Type in Ask ProBot — ‘who owes me money?’, ‘how many customers?’, ‘what’s today look like?’ I answer from your books, then drop a page button (Contacts, Invoices…) so you can walk into the full list.”',
        steps: [
          'Open ProBot.',
          'Type a short question, or use a welcome shortcut.',
          'Use the page button under the reply to open the list.',
        ],
        links: [{ label: 'Open ProBot', href: '/probot' }],
      },
      {
        id: 'what-probot-uses',
        title: 'What I look up',
        role: 'crew',
        roleLabel: 'ProBot with the books',
        story:
          '“I don’t guess. Contacts, Invoices, Estimates, Projects, Calendar, Maintenance — if it’s in your CRM for this business profile, that’s what I read. Counts and names match the screens you already use.”',
      },
    ],
  },
  {
    slug: 'probot/voice',
    title: 'Voice notes',
    lead: 'Hands full of pipe? ProBot listens, then answers out loud when the voice note is ready.',
    heroRole: 'plumber',
    sections: [
      {
        id: 'send-a-voice-note',
        title: 'Talk from the truck',
        role: 'plumber',
        roleLabel: 'ProBot the plumber',
        story:
          '“Hard hat on, wrench in hand — I still pick up. Tap the mic on Ask ProBot, say something short like ‘any invoices open?’, and send. The text and the voice reply show up together when I’m done recording.”',
        steps: [
          'Tap the microphone on Ask ProBot.',
          'Speak, then send.',
          'Wait for the bubble and player together.',
        ],
      },
      {
        id: 'tips',
        title: 'Keep it short',
        role: 'electrician',
        roleLabel: 'ProBot the electrician',
        story:
          '“One question at a time. Counts, who owes money, what’s on the schedule — that’s my sweet spot when you’re on a ladder.”',
      },
    ],
  },
  {
    slug: 'probot/welcome-shortcuts',
    title: 'CRM shortcuts on welcome',
    lead: 'Empty ProBot chat: ProBot lays out the shop tools before you even type.',
    heroRole: 'guide',
    sections: [
      {
        id: 'available-shortcuts',
        title: 'Tap a box, open the shop',
        role: 'business',
        roleLabel: 'ProBot opening the shop',
        story:
          '“No messages yet? I put Calendar, Contacts, Estimates, Invoices, Projects, Expenses, Add Task, and Add a customer under the greeting. Tap one and that CRM view opens — Back brings you to me again.”',
        steps: [
          'Open ProBot with an empty thread (business profile).',
          'Tap a shortcut box.',
          'Use Back, or ask me in the bar below.',
        ],
        links: [{ label: 'Open ProBot', href: '/probot' }],
      },
    ],
  },
  {
    slug: 'crm/contacts',
    title: 'Contacts',
    lead: 'ProBot the owner keeps the customer list honest — Customer role means customer.',
    heroRole: 'business',
    sections: [
      {
        id: 'open-contacts',
        title: 'Meet your people',
        role: 'business',
        roleLabel: 'ProBot with the rolodex',
        story:
          '“Contacts are everyone in your CRM. Customers are the ones wearing the Customer role. Open ProsCRM → Contacts, or ask me ‘how many customers?’ and hit the Contacts button under my answer.”',
        steps: [
          'Open Contacts (or ask ProBot for the count).',
          'Search or filter.',
          'Open a card to edit details and roles.',
        ],
        links: [{ label: 'Contacts', href: '/crm/customers' }],
      },
      {
        id: 'add-a-contact',
        title: 'Add someone new',
        role: 'crew',
        roleLabel: 'ProBot taking a name',
        story:
          '“New neighbor on the job? Use Add a customer from my welcome screen or from Contacts. Name, details, save — I’ll remember them next time you ask.”',
      },
    ],
  },
  {
    slug: 'crm/estimates',
    title: 'Estimates',
    lead: 'ProBot walks a quote from draft to “still waiting.”',
    heroRole: 'business',
    sections: [
      {
        id: 'work-with-estimates',
        title: 'Send the quote',
        role: 'landscaper',
        roleLabel: 'ProBot the landscaper',
        story:
          '“I sketch the yard, then the estimate. Open Estimates, build or edit a draft, send it. Ask me which estimates are waiting when you want the cold ones without digging.”',
        steps: [
          'Open Estimates in ProsCRM.',
          'Create or edit, then send.',
          'Ask ProBot what’s still waiting.',
        ],
        links: [{ label: 'Estimates', href: '/crm/estimates' }],
      },
    ],
  },
  {
    slug: 'crm/invoices',
    title: 'Invoices',
    lead: 'ProBot chases the balance — politely, with real numbers.',
    heroRole: 'business',
    sections: [
      {
        id: 'open-invoices',
        title: 'Who still owes',
        role: 'business',
        roleLabel: 'ProBot with the ledger',
        story:
          '“I don’t invent balances. Open Invoices, or ask me who owes you money. I’ll say what’s open, then hand you the Invoices button for the full list.”',
        steps: [
          'Open Invoices in ProsCRM.',
          'Create from a job or from scratch.',
          'Ask ProBot who owes money when you need a quick read.',
        ],
        links: [{ label: 'Invoices', href: '/crm/invoices' }],
      },
    ],
  },
  {
    slug: 'crm/projects',
    title: 'Projects',
    lead: 'From first stake to last paver — ProBot keeps the dates straight.',
    heroRole: 'crew',
    sections: [
      {
        id: 'track-projects',
        title: 'Jobs on the board',
        role: 'painter',
        roleLabel: 'ProBot the painter',
        story:
          '“Start date, finish date, customer on the job. That’s how I answer ‘what finishes this week.’ Open Projects, set the dates, link the contact — then ask me anytime.”',
        steps: [
          'Open Projects in ProsCRM.',
          'Set start and end dates.',
          'Link the customer.',
        ],
        links: [{ label: 'Projects', href: '/crm/projects' }],
      },
    ],
  },
  {
    slug: 'crm/calendar',
    title: 'Calendar & schedule',
    lead: 'ProBot on the crew checks the day before the truck rolls.',
    heroRole: 'crew',
    sections: [
      {
        id: 'use-the-calendar',
        title: 'What’s today',
        role: 'crew',
        roleLabel: 'ProBot with the day board',
        story:
          '“Appointments, estimate visits, maintenance, project days — I read the same Calendar you do. Open it from ProsCRM or my shortcuts, or just ask ‘what’s on my schedule today?’”',
        steps: [
          'Open Calendar or ask ProBot about today/tomorrow.',
          'Add visits and tasks so the board stays true.',
        ],
        links: [{ label: 'Calendar', href: '/crm/calendar' }],
      },
    ],
  },
  {
    slug: 'crm/expenses',
    title: 'Expenses',
    lead: 'Materials run? ProBot logs it before the receipt gets lost in the truck.',
    heroRole: 'plumber',
    sections: [
      {
        id: 'log-expenses',
        title: 'Capture the cost',
        role: 'plumber',
        roleLabel: 'ProBot with a receipt',
        story:
          '“Supply house run. I open Expenses, type vendor, amount, date, category, snap the receipt if I’ve got it. Ask me later and the books still match the field.”',
        steps: [
          'Open Expenses from ProsCRM or ProBot.',
          'Add vendor, amount, date, category.',
          'Attach a receipt when you can.',
        ],
        links: [{ label: 'Expenses', href: '/crm/expenses' }],
      },
    ],
  },
  {
    slug: 'homeowners/find-a-pro',
    title: 'Find a pro',
    lead: 'ProBot as the neighbor who knows everyone on the block.',
    heroRole: 'customer',
    sections: [
      {
        id: 'browse-the-directory',
        title: 'Browse the block',
        role: 'customer',
        roleLabel: 'ProBot the neighbor',
        story:
          '“Need a plumber, landscaper, painter? I walk the directory with you — category, search, open a card, message or request an estimate. No hard sell, just the right door.”',
        steps: [
          'Open the business list.',
          'Filter by category or search by name.',
          'Open a card to message or request an estimate.',
        ],
        links: [{ label: 'Find pros', href: '/businesslist' }],
      },
    ],
  },
  {
    slug: 'homeowners/request-estimate',
    title: 'Request an estimate',
    lead: 'ProBot helps you tell the story of the job so pros can answer.',
    heroRole: 'customer',
    sections: [
      {
        id: 'request-steps',
        title: 'Tell them what you need',
        role: 'customer',
        roleLabel: 'ProBot writing it down',
        story:
          '“Free Estimate in the menu or on a pro card. Describe the project, where, and when. Submit — then watch chat for replies. I’ll keep you company while you wait.”',
        steps: [
          'Tap Free Estimate.',
          'Describe project, location, timeline.',
          'Submit and watch for replies in chat.',
        ],
        links: [{ label: 'Free estimate', href: '/estimate' }],
      },
    ],
  },
  {
    slug: 'homeowners/my-places',
    title: 'My Places',
    lead: 'Every house gets a folder. ProBot helps you keep the plans in one spot.',
    heroRole: 'customer',
    sections: [
      {
        id: 'use-my-places',
        title: 'One home, one place',
        role: 'customer',
        roleLabel: 'ProBot with the house keys',
        story:
          '“My Places is your stack of house folders. Add a property, drop photos and files, share a place into chat when you message a pro. Personal profile unlocks it.”',
        steps: [
          'Open My Places (personal profile).',
          'Add a property; upload photos or files.',
          'Share a place into chat when you talk to a pro.',
        ],
        links: [{ label: 'My Places', href: '/myplaces' }],
      },
    ],
  },
];
