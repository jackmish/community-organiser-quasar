Copyright (c) 2026 Jacek Miszczuk. All rights reserved.

# Community Organiser 21 - CO21

The main goal of this application is to simplify organization for families and communities; in its current state it serves as a personal organizer for events and tasks.

The application is designed to work primarily offline—even in environments with no internet access—and is not constrained by the storage limits common to some PWAs that rely on servers to continue operating.

I'll make some final Readme.md closer to version 0.9 of app. Now i cant even name it Early Access, a specially when im looking at "vibe code".

Second reason was to check what AI/Copilot would generate without any engineering tips and refactor it later. UX development and app features were 1st, now as usual opinion "vibe code" like attempt do many mess,... but it works fine. It was hard to not show AI that for example whole app is initiating 7 times, solution also wasn't best. AI does'nt like DRY - it likes very much to repeat itself, whatever AI model it was.

## Name and ideology

The ideology is to make easier organisation lifes, and connect some internal devices inside house, meeting room or star-ship - without required payments / advertisments, but it could make some money for itself other ways.

The chosen name, CO21, stands for Community Organiser with the number chosen as a distinguishing element. Human communities are emitting CO2 so its maybe not so bad name, but probably chemically CO21 would be toxic or neutral or just impossible atomic structure. The logo is an initial design created in Inkscape.

## Main features

1. Time-based tasks — scheduling meetings, reminders about upcoming events, vehicle insurance renewals, expiring ID documents, task deadlines, cyclic events etc.
2. To-do tasks — items not yet tied to a specific time. Each task can later be associated with time; simple task/subtask lists are supported. Subtasks are created by prefixing lines with "-". The app can recognize pasted lists and detect subtasks without modifying the original text; a marker appears only when a subtask is marked complete.
3. Shopping lists and replenishment tasks — items marked with colors at creation or edit time. For example, a chocolate item can be given a chocolate color and later re-added from a quick search. These tasks use a minimal visual style and appear alongside general tasks and events to avoid checking multiple views.
4. Groups module — flexible structure, for example: Family -> car, home, child A, child B, parent -> parent's hobby. Tasks flow according to settings: tasks from direct children groups are included in the parent group, while deeper tasks (e.g., a hobby) are deemphasized; time reminders are not ignored. You can change active group and set view with filtered list
5. Calendar module — designed to make it easier to understand time gaps; recurring tasks illustrate routines. Holidays also appear and are currently the main feature that may use the internet (optionally). Holiday data is fetched once for a two-year window from the current year and then stored locally.
6. Task, event and shopping list view — allows expanding task details.
7. Reminder bar at the top — a persistent expandable line to prevent forgetting and to highlight upcoming events.

## App guide

Below are a few screenshots from the in-app guide (files available in `public/app-guide`).

<p align="center">
  <img src="public/app-guide/CO21%20-%20main%20layout.jpg" alt="Main layout" style="max-width:800px;width:100%;height:auto" />
</p>

| Ways to complete task/subtask, as whole task or list edited anywhere like:

-Make an appointment*<br/>
-Fix brakes*<br/>
-change oil <br/> -[x] Replace windshield wipers |

<p align="center">
  <img src="public/app-guide/way-to-complete-task-or-subtask.jpg" alt="How to complete task or subtask" style="max-width:800px;width:50%;height:auto;float:left;" />
</p>

| Replenishment list - with universal input used as:
a) using as searching/selecting element already created items
b) is used as name of new item |

<p align="center">
  <img src="public/app-guide/replenishment.jpg" alt="Replenishment list" style="max-width:800px;width:50%;height:auto;float:left;" />
</p>

## Compatibility

This project is in early development and is tested mainly at small laptop-like and large-screen resolutions. Many adjustments aim to provide a mobile layout suitable for Android, and later possibly iOS and Linux.

## Next steps

- Make App more useful, use it, improve UX crucial fixes. Code isnt first, but app usage experience is, at least at this point.
- Fix less important issues, and organize and clean up the codebase. Refactor has began and its long way, when engineering was skipped during creation process with Copilot/VsCode mostly ChatGPT5 + sometimes Claude Sonnet. It would be maybe nice way to learn how to fix vibe/spaghetti, but rather also with AI automation, and maybe later with another solutions.
- Finish Bluetooth data synchronization between devices
- Mobile application - and finish layout details, a specially buttons inside task creation form.
- User and permission system, mainly to dedicate a home tablet that displays the family's task schedule without requiring data restores
- Complete the notes module for contacts, planning, recording vehicle repair costs, tracking storage locations for important items, lending items, and a small community-fee/treasurer feature

## Project installation instructions (generated by AI)

- **Frontend**: Quasar Framework v2 (Vue 3, TypeScript)
- **Desktop**: Electron
- **Styling**: Quasar Components
- **Data Storage**: JSON files (Electron) - planned data sync with server database API, and maybe i'll change my mind to save it inside some lite DB in Electron offline mode.

## Getting Started

### Install the dependencies

```bash
npm install
# or
yarn install
```

### Development

#### Start the Electron desktop app

```bash
npm run electron
```

### Production

#### Build for Electron (desktop)

```bash
npm run build:electron
```

### Code Quality

#### Lint the files

```bash
npm run lint
# or
yarn lint
```

#### Format the files

```bash
npm run format
# or
yarn format
```

## Automated tests

- **Unit tests (Vitest):** located in `tests/unit`. Run unit tests with:

```bash
npm run test:unit
# or
yarn test:unit
```

- **End-to-end tests (Playwright):** located in `tests/e2e`. Run e2e tests with:

```bash
npm run test:e2e
# or
yarn test:e2e
```

- **All tests / quick run:**

```bash
npm test
# or
yarn test
```

(Test mostly manual, but app is growing... so something is already installed. With mobile app execution time profiling would be most wanted)

- **Coverage:** Vitest coverage is configured — to run coverage for unit tests:

```bash
npm run test:unit -- --coverage
```

- **Notes & guidelines:**
  - Ensure dependencies are installed (`npm install` / `yarn install`).
  - Place unit tests in `tests/unit` and e2e tests in `tests/e2e`.
  - Keep tests small and focused; mock external services where appropriate.
  - Use `tests/setup.ts` for common test setup/teardown (already present).
  - Consider adding a CI workflow (GitHub Actions or similar) to run tests on PRs.

## Data Storage

- **Desktop (Electron)**: Data is automatically saved to `%APPDATA%/community-organiser/`

## Configuration

See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js) for customization options.

## About the code and application design (notes)

The development process can be broken into stages:

1. Choosing technologies and confirming that a familiar framework is a good choice.
2. I might not have had as much motivation to build this app if I had not previously used AI to create a small Laravel project that proved practical with little effort. This time I decided to generate something larger and less typical mainly using prompts. I note that AI did not necessarily save time overall and may have even added work, although it allowed me to focus on things other than coding.
3. Stage three consisted mostly of "lazy" prompt input, concentrating on project thinking, design, appearance and user-facing features (with an intuition about where that would lead).
4. After the main features were implemented I stopped adding features and focused on tidying the app. In short, this stage could be called an Augean stable, though I do not entirely blame AI—many factors led to this state. Working on the architecture after AI-generated code can be interesting and also a logical puzzle or challenge.

## Conclusions after using AI prompts:

### NEW | Claude Refactor

One of the most important target of this project is to check if I can +- vibe code some project, just make some few suggestions to AI with 0x credits models and than use some better AI model to make code more acceptable after refactor. Im usually using Claude Sonnet 4.6 - and I'm not going to change IDE to something AI first. But maybe it would be interesting git branch.

My method for this project is to use cheap GPT5.1 or other better cheap model, and refactor it after some stage of development - last 2 times - just i've lost my patience, last time with unit tests problems.

Only GPT5.1 mini was able to be good enough with VueJS emit's logic. I agree with AI its one of the most confusing thing around Vue Framework, but its a problem when you are maybe backend developer and need to fix something ASAP.

Its not very bad tool for vibe code but 1 condition - patience, or alternatively compromise.

Using primarily Claude does not guarantee quality. It good tool for refactor, but structure/pattern decision really matters. Its not simple choice when AI is producing code, how make more clarity for AI engine? Thats also the question but probably project map is same good for AI engines as sitemap for Google old browsing engine.

Claude Sonnet also would'nt fix unit tests after refactor, it still wants to create missing files. It likes to generate unit test but does'nt think code needs to be refactored first. I'll check unit tests later when would be preferable. Most errors are generated by the way of css unconnected things than code errors, so probably I can tell they are not crucial at this point. Code quality could be more welcome, but unit tests are going to make code more "constant/persistent".

Rewriting unit tests from 0 is sometimes best option, and it could be not time saving option, when GPT5.1 is primary AI model, doing "vibe code". Solution is to write unit tests after Claude Refactor not earlier.

I'm going to use some external non AI tool to make some maps automatically, or just maybe just Swagger Docs, somewhere around API's.

When i was asked about apiTask name it answered it mostly looks like Pinia. I wasn't sure it was good to install it with GPT5.1 (never used Pinia before), but this time message with advantages was clear. I knew earlier just that it was popular.

Claude makes many similar mistakes as GPT5.1 mini but many operations needs less time with Claude, and code is usually in much better shape - its much more powerful. Still generated unit tests are not including many serious infos about errors. After refactor of some content once again task list was empty - without TODO task type, missing css button borders, and still I don't think refactor was good enough, I need to schedule some AI instructions to create important tests. Still code requires some improvements, a specially i cant love this chaos of exports, but at least files are smaller now. Singletons are ok but AI definition of singleton contains plain object, skipping TypeScript advantages.

### OLD | EXPERIENCE MOSTLY WITH GPT5.1 mini model 0x credits - 10$ per month + manual updates and maybe once Claude at beginning.

I am used to VS Code, so I naturally used Copilot, though I know there are other tools. ChatGPT v4 struggled in many cases; most of the code was produced with ChatGPT5 mini, which handled Vue.js much better.

Some paid AI services performed better for code, but they also contributed to code mess in similar ways. A poor start with ChatGPT4 and attempts to adapt other AIs to that style may have caused problems.

Why this project didn't go as smoothly as the Laravel project:

- Lack of initial design constraints. In the Laravel project I immediately installed modules like Nwidart, which are not included by default; such modules can greatly improve file structure and responsibilities.
- Backends are typically more business-oriented and organized (e.g., session systems) while frontends usually receive data without session state and then apply separate logic focused on responsiveness in modern JS frameworks.
- Vue.js may have fewer clear examples on GitHub and can be harder to learn; frontend projects (Vue or jQuery) often become messy with chaotic event handlers and hard-to-trace data flows.
- ChatGPT4 in particular struggled with passing data between components. Event/emit/watch patterns using string identifiers cause confusion for AI. I opted to replace some of these patterns with clearer approaches (for example, using explicit calls like `api.task.update` in components instead of relying on ambiguous emits). A central configuration and management system for main data is one recommended approach - probably used in future, plugins as access point for app functionalities.
- AI sometimes changes imported variable names across files when working with Vue and TypeScript, obscuring the origin of functions, classes or factories. Repeated code generation and re-initialization without centralization is also common. Maybe its creating helper maps for itself, to better understand file logic, repeating definitions in many files instead of using import of whole object/class with everything already defined. TS import separated functions are rather inconvinient way of organising projects - but AI prefers making all inside .vue components by default - probably. Making API/some structure from beginning could avoid unnecessary generative mess. At this moment not detailed prompt would generate more chaos, so global refactor is rather too important thing before I can contiunue some development, and it would have highest priority + only small improvements of existing app features, bug fixes.
- AI limitations and its tendency to copy patterns from other repositories can cause stubborn, repetitive behavior. Precise, detailed prompts help, but AI may ignore guidelines until it sees established patterns in the project. Refactoring AI-generated code is possible but can be challenging.
- Using export/import functionalities - with or without AI always looks like mess for me. Without objective code organisation, a specially making class objects - clearly inheriting some restrictions and possibilities i can feel confused even with own code.
- weaker AI model usually means more plain/monolith structure, even if you've been declaring some classes/interfaces (GPT5.1 mini or mostly Claude AI models), wont search for it without correct guidance or model specialized more for some frameworks. Its a bit similar problem to graphic models, which could be better in some kind of topics, but even largest models could fail with simply tasks. Drawing castle/architecture is a problem for most graphic models event largest online giants, but some locally installed models could do task slightly better.
- refactor - i've tried some methods, but it's not still best moment - im just loosing some patience. AI probably isn't using correct tools/methods for refactor. It uses mostly AI engine to talk about "feelings", making some literature instead of creating something useful for AI. It does not recommend tools, its not making project maps, it mostly is directed by chaos - RNG/Seed. I'll try to make some maps using AI or external tools to schedule some convenient structure/classes/patterns for me and AI. Lot of names of files/classes probably are not describing correctly patterns, still wonder how to name some files or maybe just move some functionality to other places.
- automatic test before refactor - could be helpful but also ineffective. Refactor could change a lot in code and also generate chain changes inside testing code. Maybe it would be better moment for them when project structure would be more solid, not repeating itself, just less like AI code. Probably more premium AI models could do it faster than GPT5.1 mini.
  GPT5.1 will usually generate/revert back file which was removed from project after refactor instead of changing testing code. It would be better to write tests from 0 after some project stage, a specially adapting layout for mobile app/and sync it with all devices could be best moment for refactor and all automated testing features.

Practical takeaways:

- Manually moving HTML and adjusting `v-if` or renaming variables after generation is often faster than trying to make AI produce perfect code.
- There is risk using AI—compare it to taking on a large loan: it can accelerate progress but may add costs later as the project grows
- Development costs with AI can be low at the start but higher later without sufficient quality control—similar risks exist with human-written code.
- Heavy refactoring led me to a greater interest in architecture, best practices and maintainability. Looking at any AI-generated code—clean or messy—can still teach useful tricks.

The project will likely be part of a blog or vlog about AI, where I'll provide concrete examples, or not if other priorities would be dominating.

Before a production release, critical features (data backup/restore and optional Bluetooth communication or optional backend/server configuration) will be thoroughly tested.

An offline-only app will expose similar risks as a note-taking app or calculator. It's still best to connect only with trusted contacts, as social apps sometimes propagate messages people did not actually send.

## About license and distribution plans for the full version

- Until the full release I will delay choosing a license and will provide read-only access to the source for now.

- The base offline application will likely be free, with optional paid services or revenue mechanisms to support server costs (for example, email sending, online sync, or hosted services without requiring users to configure their own servers).
