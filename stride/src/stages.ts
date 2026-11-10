import { LBG_VALUES } from './data';
// Engineering job family PoC. Stages 0-5, each unlocked by the trigger on the previous stage.
// Placeholder content: confirm copy and triggers with the Lloyds team before any real use.

export type Owner = 'you' | 'manager' | 'system';

export type StepKind =
  | 'auto' // system does it (shown as done or waiting)
  | 'info' // read-only text
  | 'check' // tick off
  | 'link' // a link to learning or articles
  | 'details' // personal details form
  | 'values' // values explorer
  | 'date' // propose a start date
  | 'meeting' // request a check-in with the line manager
  | 'device' // Mac or Windows
  | 'photo' // building access photo, taken with the camera or chosen from the phone
  | 'objectives' // free-text objectives
  | 'contacts' // emergency contacts
  | 'upn' // manager sets up the new starter's work email address
  | 'laptop' // laptop dispatched (IT)
  | 'article' // read-through text, optionally expanded by default
  | 'guide' // set-up guide, shown for the device chosen in Stage 3
  | 'induction' // book a place on the monthly virtual induction
  | 'startday'; // start date, location and first-day guidance

export interface Step {
  id: string;
  title: string;
  body?: string;
  kind: StepKind;
  owner: Owner;
  href?: string;
  // Longer text, shown when the step is opened
  paragraphs?: string[];
  // Expandable sections, each opened separately
  sections?: { title: string; text: string; href?: string }[];
  openByDefault?: boolean;
  // Step id that must be done before this one opens
  after?: string;
  // Device-specific steps (guide kind), keyed by device
  guides?: Partial<Record<'standard-mac' | 'developer-mac' | 'windows', { title: string; text: string }[]>>;
}

export interface StageDef {
  id: number;
  name: string;
  summary: string;
  // Plain-language trigger that unlocks the NEXT stage
  trigger: string;
  steps: Step[];
}

export const JOB_FAMILY = 'Engineering';

// Short, plain-English descriptions of the five LBG values, shown as expandable sections.
const VALUE_SUMMARIES: Record<string, string> = {
  'People-first': 'Putting people first, listening to them as individuals and going the extra mile, so customers feel supported and in control of their future.',
  Bold: 'Doing things differently to serve customers better and grow with purpose. We challenge what is not right and act to change it.',
  Inclusive: 'Valuing everyone, learning from our differences and seeking out different perspectives, so what we do fits the needs of our customers and colleagues.',
  Sustainable: 'Taking responsibility for our impact on nature and on Britain’s move to net zero, and thinking through the consequences of our decisions.',
  Trust: 'Giving each other the space and support to see things through, being honest with one another and explaining our decisions.',
};

// PLACEHOLDER COPY: confirm wording and facts with the Lloyds brand and history teams before launch.
const CANCARA_STORY = [
  'Cancara is your AI buddy. It is here whenever you have a question, and it will point you to the next step in your journey.',
  'The black horse has been part of Lloyds for a very long time. It stands for strength, reliability and getting you where you need to go, which is what this journey is about.',
  'Ask Cancara anything from the button at the bottom right of the screen. If it cannot answer, it will pass your question to your line manager on Teams.',
];

const LLOYDS_HISTORY_SECTIONS: { title: string; text: string }[] = [
  {
    title: '1765: a Birmingham beginning',
    text: 'Our roots go back to a private bank set up in 1765 on Dale End, Birmingham, by John Taylor and the Quaker iron dealer Sampson Lloyd. Sources differ on exactly which Sampson Lloyd was involved.',
  },
  {
    title: 'The black horse',
    text: 'The black horse is one of the best-known symbols in British banking. Its origin is disputed. The most common account traces it to 1677, when Humphrey Stokes used a black horse as his shop sign. Other accounts credit a goldsmith, John Bland, in 1728. Lloyds took over a bank trading under the sign in 1884.',
  },
  {
    title: '1889: Lloyds Bank Limited',
    text: 'The business became Lloyds Bank Limited in 1889. Over the next century it grew by acquiring and merging with other banks.',
  },
  {
    title: '1995: Lloyds TSB',
    text: 'TSB Group merged with Lloyds Bank in 1995, forming Lloyds TSB Group.',
  },
  {
    title: '2001: HBOS',
    text: 'Halifax and the Bank of Scotland merged in 2001 to form HBOS.',
  },
  {
    title: '2009: Lloyds Banking Group',
    text: 'In 2008, with support from the UK Government, Lloyds TSB agreed to acquire HBOS. The deal completed in January 2009, and the group became Lloyds Banking Group.',
  },
  {
    title: 'Today',
    text: 'We are one of the UK’s largest retail banks, and our purpose is to help Britain prosper. That purpose connects our past to the work you will do here.',
  },
];

export const STAGES: StageDef[] = [
  {
    id: 0,
    name: 'Conditional offer',
    summary: 'You said yes. Your Stride account is ready.',
    trigger: 'You accept the job',
    steps: [
      { id: 's0-accept', title: 'You said yes to the job', kind: 'info', owner: 'you', body: 'Welcome to Lloyds. Your offer is accepted.' },
      { id: 's0-account', title: 'Stride account created', kind: 'auto', owner: 'system', body: 'Created automatically once you accept.' },
      { id: 's0-login', title: 'Login sent to your email', kind: 'auto', owner: 'system' },
      { id: 's0-manager', title: 'Line manager and buddy contacted', kind: 'auto', owner: 'system' },
    ],
  },
  {
    id: 1,
    name: 'Get set up',
    summary: 'Confirm your details and get to know Lloyds.',
    trigger: 'Vetting is complete (Workday)',
    steps: [
      { id: 's1-details', title: 'Confirm your details', kind: 'details', owner: 'you', body: 'Linked from Workday. Check these are right.' },
      { id: 's1-cancara', title: 'Meet Cancara, your AI buddy', kind: 'article', owner: 'you', openByDefault: true, after: 's1-details', body: 'Cancara guides you through every stage.', paragraphs: CANCARA_STORY },
      { id: 's1-history', title: 'The history of Lloyds Bank', kind: 'article', owner: 'you', after: 's1-cancara', body: 'Where we came from, and how we got here. Open each part to read more.', sections: LLOYDS_HISTORY_SECTIONS },
      { id: 's1-values', title: 'Our values', kind: 'values', owner: 'you', body: 'Tap each icon to explore the five values, one by one. Open each part below to read more.', after: 's1-history', sections: LBG_VALUES.map((v) => ({ title: v.name, text: `${VALUE_SUMMARIES[v.name]} The opposite is: ${v.opposite}` })) },
      { id: 's1-strategy', title: 'Our strategy', kind: 'article', owner: 'you', after: 's1-values', body: 'What we are working towards, and what it means for you. Open each part to read more.', sections: [
        { title: 'Our purpose and strategy', text: 'Our purpose is to help Britain prosper every day and in life’s key moments. Our strategy is how we deliver that: looking after our customers, lending to homes and businesses, backing the move to net zero, being a digital bank, and delivering sustainable returns.' },
        { title: 'Looking after customers', text: 'We want to be there for people through big life moments, such as buying a first home, saving, caring for family and planning for retirement. We support customers in tough times, too, including cost-of-living help.' },
        { title: 'Lending to homes and businesses', text: 'We help first-time buyers and build finance for social housing, and we lend to businesses of all sizes, including small and medium-sized firms. In 2023 we supported around 56,000 first-time buyers.' },
        { title: 'Net zero and sustainable finance', text: 'We are backing the UK’s move to net zero by financing businesses that cut emissions. We set a £30bn transition finance target for 2024 to 2026.' },
        { title: 'Going digital', text: 'Most of our customers now bank with us digitally. In 2023 we had 21.5 million digitally active customers, and we are investing heavily in digital services and in simplifying how we work.' },
        { title: 'Performance and returns', text: 'We aim to deliver strong, sustainable returns, with clear financial targets for 2026, including a return on tangible equity above 16%. Doing well financially lets us keep investing in customers and communities.' },
        { title: 'What it means for you', text: 'Every role at Lloyds contributes to the strategy. Your work in Engineering helps us serve customers better, make our services simpler and safer, and build the digital bank of the future.' },
        { title: 'A note on figures', text: 'The figures here come from public reporting and may have changed. Check the latest Lloyds Banking Group publications before using them.' },
      ] },
      { id: 's1-benefits', title: 'Your benefits', kind: 'article', owner: 'you', after: 's1-strategy', body: 'What is in your package and how each part works. Open each part to read more.', sections: [
        { title: 'Your package at a glance', text: 'As well as your salary, you get a pension, private medical cover, holiday, share plans, flexible working, family leave and discounts on Lloyds products. Many parts of the package can be tailored through the Flex benefits scheme.', href: 'https://www.lloydsbankinggroup.com/careers/why-join-us/benefits.html' },
        { title: 'Flex benefits: choose what matters to you', text: 'Flex lets you tailor parts of your reward package as your priorities change. Options include extra healthcare, dental plans, health assessments, critical illness cover, life assurance and holiday trading. Cashback comes through the Flex Card, Cycle2Work and a sustainable car scheme. The amount of Flex available and the cost of each option are not published on the main page, so check with HR.', href: 'https://www.lloydsbankinggroup.com/careers/why-join-us/benefits.html' },
        { title: 'Pension', text: 'You join the pension automatically. Employer contributions start at 9% when you contribute 3% of your salary, and rise to up to 15% when you contribute 6% or more. Rates in between are not listed on the main page.', href: 'https://www.lloydsbankinggroup.com/careers/why-join-us/benefits.html' },
        { title: 'Private medical cover', text: 'Private medical cover is company funded for permanent colleagues. It includes free annual cancer screenings, physiotherapy, neurodiversity assessments and menopause support. You can extend cover to eligible family members for a small fee.', href: 'https://www.lloydsbankinggroup.com/careers/why-join-us/benefits.html' },
        { title: 'Holiday', text: 'You get 22 to 30 days’ holiday plus bank holidays, depending on your role. You can buy or sell up to a week’s holiday in the year.' },
        { title: 'Share plans', text: 'Sharematch: for every two shares you buy, you get three free, up to £45 a month. Sharesave: save monthly during the annual enrolment window, then buy shares at a discounted price or take your savings back, plus a tax-free bonus.', href: 'https://www.lloydsbankinggroup.com/careers/why-join-us/benefits.html' },
        { title: 'Flexible working and family leave', text: 'Most office-based colleagues spend at least 40% of their time in the office. You can ask for adjusted hours, compressed hours or a career break, and many colleagues can work from anywhere in the UK for up to six weeks in Flexible Summer. Primary carers can take up to 52 weeks’ family leave, including six months on full pay. Partners get six weeks of fully paid leave.' },
        { title: 'Discounts and everyday perks', text: 'You get preferential rates on Lloyds Banking Group products, and discounts on everyday purchases.' },
        { title: 'A note on figures', text: 'These details come from the official Lloyds Banking Group benefits page and may change. Check the page, or ask HR, for the latest details, including your Flex allowance.', href: 'https://www.lloydsbankinggroup.com/careers/why-join-us/benefits.html' },
      ] },
      { id: 's1-vetting', title: 'Vetting', kind: 'auto', owner: 'system', body: 'Completed in Workday. We will tell you here when it is done.' },
    ],
  },
  {
    id: 2,
    name: 'Meet your team',
    summary: 'Talk to your line manager and agree your start date.',
    trigger: 'Start date agreed by you and your line manager',
    steps: [
      { id: 's2-checkin', title: 'Check-in with your line manager', kind: 'meeting', owner: 'you', body: 'Ask for a meeting. Your manager gets a one-click Teams invite.' },
      { id: 's2-learning', title: 'Engineering job family learning', kind: 'article', owner: 'you', after: 's2-checkin', body: 'What the Engineering job family is, what the people in it do, and what to know as a new starter. Open each part to read more.', sections: [
        { title: 'Who we are', text: 'The Engineering job family is roughly 20,000 people across Lloyds Banking Group. We build, run and protect the technology that customers use every day, from the apps on their phones to the systems behind every payment. The headcount is approximate, so check current figures with your manager.' },
        { title: 'Modern Workplace engineers', text: 'They look after the tools and devices colleagues use every day, such as laptops, collaboration tools and the Teams environment. If your laptop, access or collaboration tools misbehave, this is the team behind the fix.' },
        { title: 'Developer engineers', text: 'They design, build and change our applications and services, across web, mobile and back-end systems. Most engineers in the job family work in small, cross-functional teams that deliver change in short, regular cycles.' },
        { title: 'DevOps engineers', text: 'They build and run the pipelines that take code from a developer’s laptop to live services safely, and keep those services reliable. They look after cloud platforms and automation, and they help teams respond quickly when something goes wrong.' },
        { title: 'Data engineers', text: 'They build the pipelines and platforms that collect, store and prepare data, so colleagues can analyse it and build products on top of it. Data is handled carefully, because much of it is personal.' },
        { title: 'Cyber and security engineers', text: 'They protect our customers and our systems from threats. That includes monitoring, responding to incidents and building security into products from the start, rather than adding it at the end.' },
        { title: 'What the work involves', text: 'Expect to work in agile teams, with regular planning, reviews of each other’s code and testing before anything goes live. Most teams share responsibility for the services they build, so quality, security and reliability are everyone’s job.' },
        { title: 'Working in a regulated bank', text: 'Banking is heavily regulated, so changes go through controls, approvals and records. This is normal and it protects customers. Treat personal data, security details and system access with care from your first day.' },
        { title: 'Your first steps', text: 'Ask your buddy which team you will join and what they work on. Learn the basic tools your team uses, and book time to shadow a stand-up. Your manager can point you to role-specific learning and to the job family’s training catalogue.' },
      ] },
      { id: 's2-startdate', title: 'Agree your start date', kind: 'date', owner: 'you', body: 'Pick a date. Your line manager confirms it.' },
    ],
  },
  {
    id: 3,
    name: 'Get ready',
    summary: 'Notice, device and building access.',
    trigger: 'You upload your building access photo',
    steps: [
      { id: 's3-notice', title: 'Working notice', kind: 'check', owner: 'you', body: 'Confirm you have worked your notice with your previous employer, or are waiting for your start.' },
      { id: 's3-device', title: 'Device choice', kind: 'device', owner: 'you', body: 'Choose the laptop that suits the work you will do. Developer Macs are for engineers who build and run code locally.' },
      { id: 's3-photo', title: 'Building access photo', kind: 'photo', owner: 'you', body: 'Take a clear photo of your face with your phone camera for the access pass of the building you are registered to. Stride asks for camera access first. You can choose a photo from your phone instead. Once saved, it is sent off for printing, and your pass is posted to your home address when it is ready.' },
    ],
  },
  {
    id: 4,
    name: 'Settle in',
    summary: 'Meet the team, set objectives, and get your kit.',
    trigger: 'Your start date is approaching',
    steps: [
      { id: 's4-role', title: 'Role-specific learning', kind: 'article', owner: 'manager', body: 'Learning for your role, from Workday, plus practical set-up steps for engineers. Open each part to read more.', sections: [
        { title: 'Your learning in Workday', text: 'Your role-specific courses and learning paths live in Workday. Once Workday is connected, this link opens your personalised list. Your manager can also add courses for you.', href: '#workday-learning' },
        { title: 'Set up GitHub', text: '1. Sign in to GitHub with your Lloyds-approved account, using single sign-on where it is set up. 2. Turn on two-factor authentication. 3. Install Git and set your name and email to match your work email. 4. Set up SSH keys or your credential manager, so you are not typing passwords. 5. Ask your buddy which repositories your team uses, and clone one. Confirm the exact steps with IT and your buddy, as Lloyds tooling may differ.' },
        { title: 'Your development environment', text: 'Install the code editor and tools your team uses, from the approved software catalogue where possible. If something is not available, ask IT or your buddy before you try to install it yourself.' },
        { title: 'Never commit secrets', text: 'Passwords, access keys, tokens and connection strings must never go into code or a repository, even a private one. Use the approved secret store your team uses. If you ever expose one by mistake, report it straight away.' },
        { title: 'Your first tasks', text: 'Read your team’s README, get the project running on your machine, and pick a small starter task with your buddy. Small first changes help you learn the codebase and the way your team works.' },
      ] },
      { id: 's4-objectives', title: 'Preparing your objectives', kind: 'objectives', owner: 'you', body: 'Start preparing for life at Lloyds. Think about what you want your objectives to be over your first year, and what success would look like for you. You can come back and change this at any time.' },
      { id: 's4-entra', title: 'Receive your work email address', kind: 'upn', owner: 'manager', body: 'Your line manager sets up your work email address. You will use it to sign in to your laptop and to Lloyds systems when it arrives.', sections: [
        { title: 'What you will receive', text: 'Your work email address, the one you will use to sign in to your laptop and to Lloyds apps. Your manager adds it, so it is ready before your device arrives.' },
        { title: 'How you will sign in', text: 'When your laptop arrives, sign in with your work email address and the temporary password you are given. You will be asked to set your own password and to set up multi-factor authentication, usually with an authenticator app on your phone. Have your phone ready.' },
        { title: 'Keep it safe', text: 'Use your work email address only for Lloyds work, and never share your password or sign-in codes with anyone, including colleagues.' },
        { title: 'If you cannot sign in', text: 'Contact IT support first, and let your buddy or manager know so they can help you get started.' },
      ] },
      { id: 's4-laptop', title: 'Laptop and welcome pack sent', kind: 'laptop', owner: 'system', body: 'Your laptop is on its way.' },
      { id: 's4-guidance', title: 'Laptop guidance', kind: 'guide', owner: 'you', body: 'Set up your laptop when it arrives. The steps below follow the device you chose. Some steps may differ slightly, so IT will confirm the exact process.', sections: [
        { title: 'Before you start', text: 'Have your work email address, the temporary password from your manager’s set-up, and your phone ready for multi-factor authentication.' },
        { title: 'First sign-in', text: 'Connect to the internet, sign in with your work email address and temporary password, then set your own password. Set up multi-factor authentication with an authenticator app on your phone.' },
        { title: 'Updates and security', text: 'Let the device finish its updates before you do anything else, and keep it switched on and plugged in while it does. Accept any security prompts it shows.' },
        { title: 'Install your apps', text: 'Open the company self-service app to install the standard Lloyds apps, such as Teams, Outlook and your browser. Install anything else your team needs through the same route.' },
        { title: 'Ask Cancara for help', text: 'For the remaining steps, such as Lloyds-specific settings and connecting to our systems, open the IT area on the Lloyds intranet and search for IT@LBG, then follow the knowledge articles there. If you get stuck, you can also ask Cancara for help from the button on this screen.' },
        { title: 'When to contact IT', text: 'Contact the IT@LBG helpdesk if you cannot sign in, if the device will not update, or if a standard app is missing after the steps above. Let your buddy or manager know too.' },
      ], guides: {
        'standard-mac': [
          { title: 'Your Standard Mac: set-up steps', text: 'Sign in with your work account on first start-up. If macOS asks to turn on disk encryption, accept it. Open the company self-service app from the Dock or Applications folder to install your standard tools.' },
        ],
        'developer-mac': [
          { title: 'Your Developer Mac: set-up steps', text: 'Follow the Standard Mac steps first. Then install the developer tools your team uses, such as the Xcode command line tools, through the approved route in the self-service app. Check with your buddy which tools to add, and ask IT before installing anything that is not listed.' },
        ],
        windows: [
          { title: 'Your Windows laptop: set-up steps', text: 'Sign in with your work account and set up Windows Hello if it is offered. Open the company self-service app to install your standard tools, and restart when it asks you to.' },
        ],
      } },
      { id: 's4-kb', title: 'Knowledge base articles', kind: 'guide', owner: 'you', body: 'Stuck on something? Here is where to find help. Open each part to read more.', sections: [
        { title: 'Find IT@LBG on the intranet', text: 'Open the Lloyds intranet, go to the IT area and search for IT@LBG. Open the knowledge articles there and find the step you are stuck on.' },
        { title: 'Ask Cancara for help', text: 'Cancara can answer quick questions about getting set up. Use the button below, or the Ask Cancara button at the bottom right of the screen.' },
        { title: 'Still stuck?', text: 'Contact the IT@LBG helpdesk, and let your buddy or manager know so they can help too.' },
      ] },
      { id: 's4-induction', title: 'Book induction with other new starters', kind: 'induction', owner: 'you', body: 'Join the monthly virtual induction with other new starters across Lloyds. It is a fun, relaxed way to meet people and get started. Optional, but we would love you to come.' },
    ],
  },
  {
    id: 5,
    name: 'Day one',
    summary: 'Your start date, training and emergency contacts.',
    trigger: 'Your start date',
    steps: [
      { id: 's5-date', title: 'Your start date and location', kind: 'startday', owner: 'you', body: 'Your start date, where you will be working, and what to expect on your first day. Your location was agreed with your manager.' },
      { id: 's5-training', title: 'Mandatory training', kind: 'article', owner: 'you', body: 'Your mandatory training is in Workday. Open the Learning section there to see what is due.', sections: [
        { title: 'Go to Workday', text: 'Sign in to Workday and open the Learning section.' },
        { title: 'Your due courses', text: 'Your Learning section shows your due courses to complete. Work through them when you can, and check the due dates so nothing is missed.' },
      ] },
      { id: 's5-contacts', title: 'Emergency contacts', kind: 'contacts', owner: 'you', body: 'Who we should contact in an emergency.' },
    ],
  },
];

// Days before the start date that the "approaching" trigger fires
export const APPROACHING_DAYS = 7;
