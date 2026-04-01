Copyright (c) 2026 Jacek Miszczuk. All rights reserved.

# Community Organiser 21 - CO21

Too early development progress to be used by anyone other than the software developer (me),

, however even now its very useful, more convenient than Google Calendar, or cant say any other organizers are better.

Prototype isn't finished yet and huge amount of refactor is waiting. Mostly i'm gathering some info about cheap model ChatGPT5.1 Mini and Cloude Sonnet 5.6 - working around VS Code/Github Copilot.

---

The main goal of this application is to create central command of communities like family, minor accounting, club, school group, team or small company.

App is focusing on central command - PC/Laptop - some workstation computer, which could work locally and organize networks without need of Internet connection - totally.

Primary Offline would be working at beginning with bluetooth synchronization. There is a plan to create backend plugin/library to integrate CMS like Wordpress and synchronize everything with Internet, a specially with own services.

---

Visually, I focus on readability than on aesthetics, so it would be rather colorful. Theme manager would be not included in version 1.0.
Of course, the layout is not finished, especially the margins and few colors are too vibrant.

Apart from comfort/expression, I will try to implement the so-called immersion so that the appearance is not a patchwork of typical form and list control components, instead of typical office layout.

This will also be the basis for the so-called smart houses, for now only within the information board and tablet/screen with announcements.

---

Second reason to create this app was to check what AI/Copilot would generate without any or small engineering tips.

## Name and ideology

The ideology is to make easier organisation lifes, and connect some internal devices inside house, meeting room or star-ship - without required payments / advertisments, but it could make some money for itself other ways.

The chosen name, CO21, stands for Community Organiser with the number chosen as a distinguishing element. Human communities are emitting CO2 so its maybe not so bad name, but probably chemically CO21 would be toxic or neutral or just impossible atomic structure. The logo is an initial design created in Inkscape.

## Main primary off-line app features

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
  <img src="public/app-guide/CO21%20-%20main%20layout - B.jpg" alt="Main layout" style="max-width:800px;width:100%;height:auto" />
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

- Make prototype functionalities using mostly "Vibe Code" method and than refactor - anything useful i'll have in mind - a specially if feature or change is small.
- Fix less important issues, and organize and clean up the codebase. Refactor has began and its long way, when engineering was skipped during creation process with Copilot/VsCode mostly ChatGPT5 + sometimes Claude Sonnet. It would be maybe nice way to learn how to fix vibe/spaghetti, but rather also with AI automation, and maybe later with another solutions.
- after some stage of project refactor, use some experimental project structure, try to make something more convenient than typical Vue or Laravel projects, a specially optimize it for AI usage + understanding project, or just agree with AI
- Finish Bluetooth data synchronization between devices
- Mobile application - and finish layout details, a specially buttons inside task creation form.
- User and permission system, mainly to dedicate a home tablet that displays the family's task schedule without requiring data restores
- Complete the notes module for contacts, planning, recording vehicle repair costs, tracking storage locations for important items, lending items, and a small community-fee/treasurer feature
- API and plugins. At this moment there is one test plugin which is just effect of my looking around

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
2. I might not have had as much motivation to build this app if I had not previously used AI to create a small Laravel project that proved practical with little effort, but also it was pointless project. This time I decided to generate something more useful and larger using this time electron more desktop solution.
3. Stage three consisted mostly of "lazy" prompt input, concentrating on project thinking, design, appearance and user-facing features (without thinking about AI garbage code. Yes - in most cases it is garbage without suggestions, and even with suggestions AI likes it's own style, mostly generating 10x more lines of code multiplying sometimes whole App init which could be very crucial for performance... more later or on blog).
4. Solving AI puzzles - Refactor. Optimizing code structure, lot of thinking also about names of newly created structures, a specially centralize around central part which is named CentralController, which is extending Pinia features, but its not only store/storage. Lot of changes were actual 100 commits ago, a specially names. Slow refactor without good conclusion could be too hard to realize with ChatGPT5.1 its much more convenient with Claude. Without good structure, project would be multiplying the same functionalities. I wonder if centralization could affect component dependency and possibility to load app part by part, but its rather not an option to not use most of Central/Core controlling app methods.

## General talking about AI:

I know from many sources that AI is used for rather smaller things, smaller projects, smaller graphics, short videos, etc. It could be called "slope", a specially creation without any control. It could be good tool to create something fast if usage of app is more important than later long process of refactor - which could improve app scalability. After refactor APP could grow more, even if its another talking about vibe coding.

There were few crucial moments when a specially cheaper AI models were working much less efficient. Larger app grows it rather would be better with more expansive AI model, but its not a problem if user knows project structure and can show AI the files is prompting smaller commands, using css words known for programmers like: position fixed, position absolute.

## Conclusions about AI models

### GPT5.1 Mini - model | Copilot VS Code | 0x credits - it means 10$ per month without additional payments

GPT5.1 mini isn't so bad but it could be really annoying, a specially for css/graphic tasks, splitting content into files, refactor. It really likes to create large files, and it has many problems with tags. It usually doesn't make any code without error. Writing automatic tests could be not best combo, when its testing code with low quality at start, that needs to be refactored. Sometimes instead of updating automatic test it would rather try to change refactored functionality, to previous state.

Trying to find correct names for project structure could be also very confusing with this model or with Claude Sonnet.

Generally app would be controlling connection with camera,...etc and its hard to find best names for offline first app, by the definitions. It would be not only organizer - it could be part of central command for Smart House or "Smart Ship".

There is also thinking about SOLID/DRY, but at this point it would be good to just split largest files into smaller and decide to some convenient project structure or use or not to use Pinia etc.

---

#### Most common code problems

Generally problems there are 3 kind of problems:

1. General project logic which is very hard to fix - its a bit like making from old building totally different one, and there are problems smaller around functions/methods inside definitions. First group of problems are describing how project is easy to read, correct not confusing names, efficient structure, how easy to sustain/extend project later or I'm planning to make some API directly or not using Central Controller and maybe API name would be back somewhere - (not Rest API but rather plugin/development API).

2. Second group of problems are affecting mostly performance, in most cases code looks fine but watching line by line i makes almost every next time new conclusion.

3. Third group is a talk about how app should work. Claude or GPT5.1 could generally easily generate memory leaks without human help. One of the cases is no validation for date. 32nd day in the month and created task/event could disappear by mistake. I've reverted single condition but by the way i've recovered 4 another tasks with problems - probably test tasks but still problem wasn't solved instantly after happening. Good practices like unit tests, validations from beginning are not strong point of vibe coding without any recommendation of user/programmer/vibe coder. Also forcing user to write correct date should be validated after create/update events, there is strong possibility that missing tasks could be fixed every time app starts or is updated. I don't want to check if AI would recommend special tool for data recover or not. There is a lot of guessing how AI will solve the problem.

---

##### Back to point 2, Example code generated by AI and some comments about it:

const groupObj = (groups.value || []).find((g: any) => String(g.id) === String(key));
if (groupObj) CC.group.active.activate(groupObj);
else CC.group.active.activate(String(key));

Its not very serious problem in small apps, but it can grow with a project. Talking about performance, app size and continue extending code with or without AI could be impossible without some cleaning efforts - refactor.

- Its TypeScript but GPT5.1 really likes to make universal methods, its not effective to navigate in universal code, find input type/definition or just use somewhere else the code not knowing input types.

- its additionally chaotic when its located inside some file, without good context why this function is needed. There is lot of abandoned functions like this, that AI should remove after refactor, or it doesn't solve the problem. Code like this is growing sometimes to 20 lines, when solution is not found in the first attempt. Additionally its usually split inside some shared file or directly inside .vue view file. Making some core/shared features is not the way this AI works.

- this time filtering isn't so bad,... but in many cases it filters too much 1) its making full flat list - doesn't try to find or create some cache with list already existing 2) than it's filtering it second time, creating second loop iterating objects once again.

- next thing - maybe active group is the same as the new one - so why to filter list before checking if there is any difference

- it should rather add/extend some helper/repository/controller class method to do some finding operation. Probably whole function is useless, when it could be wrapped inside single function like CC.group.active.setById - or something similar. Only some validation/handlers connected to component actions should be inside this specific part of code.

- Inside shared method of CC.group.active.set it would be nice to find any recommendation about some ORM/collection class but it doesn't happen without beginning programer organization plan. Laravel has built in collection/ORM - this time Quasar - doesn't have anything like this, its more frontend framework. There is a Pinia, but I thing except some dev tools its useless in this project a bit. I need to learn more about any other reasons, advantages of this solution. CC is organizing methods and memory in more simply way, avoiding array key calls, its rather self documenting - or would be after finishing refactor job.

- function/method names: active.activate() - its not bad, a specially if AI is writing code, but maybe it would be easier to use make shared "interface/class" and make "active.set()" + setById() and it would single line activating group, and i've even skipped other lines setting active group.

Refactor of things like this with GPT5.1 could take forever, sometimes with not many chances of success. After hours of waiting, correcting next errors, sometimes project can be really hard to fix by AI and human generally needs to learn the project first to fix something,... Without Git and other history tools its hard to think about AI direction of development.

- process of fixing issues or creating new things usually is like this:

a) first code almost always with errors or unfixed css/lookout. It could fix most of errors by its own, a specially if there is permission granted to tsc/lint/unit tests commands, but not all are visible without using app, a specially visual changes. Allowing AI to run app can find some problems but probably faster way is to copy errors in the chat and seeing window with opened app while doing something else is really distracting
b) Fixing errors is usually longest process of creating new thing/improving something - and most of users could give up, without knowing additional ways to "feel safe" - GIT would be rather too hard/scarry for non-coders, but AI can recommend some commands, but user doesn't know meaning of most of commands. Generally reverting single change shouldn't be very hard, and learn single command. Some video reviews are mentioning about Cursor - probably it has much less problems with code errors, but is it best option for programer? I cant tell now and its not what i'm testing now
c) reverting changes with AI Copilot build in tools is really risky, better to create much more commits before next AI job. Its another question about amount of commits, and cooperation with team.
d) AI created interface: GroupRecord. It wasn't my intention. Sometimes i can tell its my fault, but generally almost all generative AI works in similar way. It connects sometimes word interface with something else in the prompt. This interface is useless, and next commands did job rather correctly, but still code needs refactor, and unification of names, shortening code, checking possible performance optimizations, additional useless code....
e) prompted request is usually partially done. Sometimes AI creates plan/queue and sometimes not. Shorter tasks but with good explanation, telling what is working correctly to avoid some additional change is routine with models like GPT5.1. Claude usually is asking additional questions if its not sure but still not always asks even if prompt was more like a need of advice, planning moment not implementation moment.
f) sometimes fixing one thing brakes/modifying in worst case is long chain of changes. Usually if there is too many files to change its a moment when its good to think when to revert changes or give AI a chance.

#### Security issues

Its mostly talking about project installation - old dependencies or data recovery/compatibility problems. It usually ignores security issues and its very risky to use/create some Internet app features without code check. Thats most common reason making app offline first is convenient way for non-coders, or just for test reasons.

#### Conclusion about ChatGPT5.1 Mini

Generally it could be good tool for programmer. For non-coder it could work, but without good tutorial could be too hard to get in.

Claude and more premium AI models are much more convenient, You are loosing much more time fixing errors, checking progress, than with Claude.

Translating/localising content is the simplest task to make almost every AI model useful. Writing smaller parts of code, part by part could be also good reason to use this cheaper model.
Writing smaller parts of code You have probably more control of project design, but also you are slowing down process of making project prototype.

Refactor of code could be really hard with GPT5.1 mini, but I cant tell its impossible. Fixing performance issues, various warnings in browser dev tools are sometimes out of range for this model.

If You don't want to pay more than 10$ monthly or reduce cost You can use both models, and use stronger model for most hard issues.

### Claude Sonnet 4.6 - model | VS Code | 1x - it means constant 10$/month + optionally with additional credits if limit reached. Still not very expansive option.

My methodology for this project is to use cheap GPT5.1 or other better same cheap model, and refactor it after some stage of development. Plan was a bit different but i've lost my patience, i've begin some code changes before prototype was finished. Even months after start some refactor prototype isn't finished, refactor af far from complete.

Only GPT5.1 mini was able to be good enough with VueJS emit's logic, but in most cases props are working fine. I agree with AI its one of the most confusing thing around Vue Framework a specially when app is growing and components are moved in another place. Emit/props logic can be very inefficient, first i've made Central Controller for this (with other name then), and all around there was suggestion to use Pinia mostly for this problem. Global or local there is a lot of question all around Internet about this.

Using primarily Claude without engineering does not guarantee quality, even if its better model. Agent configuration and good start could be the key as for all kind of AI models/agents, but in this case/experiment i'm thinking about making usable prototype and after it improve code quality.

It can be good tool for refactor but it's rather weak without any guidance of programer or maybe greater AI learned around data with better quality. In most of graphic models sometimes more learned data means sometimes worse quality of image - when learning source was low quality.

Probably it would be good advice to Github or Microsoft to create more specialized branches of AI or maybe its already done but I can't recognize the moment of switching.

Claude Sonnet also would'nt fix unit tests after refactor, it still wants to create missing files. It likes to generate unit test but it does'nt think code needs to be refactored first - it's telling refactor was finished. I'll check unit tests later it's not so much important when i'm using this software and could do manual tests. Most frustrating errors are generated by the way of css unconnected things than code errors, which AI usually is fixing after some console typescript check/lint. Code quality could be more welcome, but unit tests are going to make code more "constant/persistent" a specially when automated test was'nt updated after code change, removed file etc.

Rewriting unit tests from 0 is sometimes best option, and it could be not time saving option, when GPT5.1 is primary AI model, doing "vibe code". Solution is to write unit tests after Claude Refactor not earlier (also i cant say its software at production, im currently the only customer, as it is with many vibe code small apps)

I'm going to use some external non AI tool to make some maps automatically, or just maybe just Swagger Docs, somewhere around API's.

When i was asked about apiTask name it answered it mostly looks like Pinia. I wasn't sure it was good to install it with GPT5.1 (never used Pinia before), but this time message with advantages was clear. I knew earlier just that it was popular. After installation I cant tell code looks more orderly. Pinia makes own object/classes which are loosing class definitions. For later uses API would be less convenient probably to access list of methods typing for example api.task... there will be no option list with Pinia - maybe, but i should test it first.

Claude makes many similar mistakes - long list of errors but not so long as GPT5.1 mini. Code is usually in better shape - its much more powerful but still it prefers to make so many small exports, and pass it through so many files instead of make class or something similar. Still generated unit tests are not including many points for checklist. Asking it for additional tests for task list is a bit hopeless. It has hard to explain logic, many rules, but maybe Option stores definition from Pinia specification looks good enough, makes some data structure instead of writing at least twice name of state to define/declare it - at beginning and inside export. I really don't like to repeat declarations. I like also when most of definitions are by the way storing validation definition nearby logic, not in separate file or object. I'm not sure it is really useful. Access to variables via string parameters isn't probably best idea, maybe i'll try something else later. There is a class for store object, and probably it would be renamed or not if it really would be object for external plugins etc. Maybe better idea is to enclose Pinia Store inside class, but finally its not a problem to access this central communication object way: api.task.list.etc... Declaration is a bit confusing at first but it works fine, and probably will extend this api/store.

After refactor of some content once again task list was empty - without TODO task type, missing css button borders, and still I don't think refactor was good enough, I need to schedule some AI instructions to create important tests. Still code requires some improvements, a specially i cant love this chaos of exports, but at least files are smaller now. Singletons are ok but AI definition of everything is mostly plain object without type. It usually recommends interfaces for things which would be not redefined with some replacement/other case of usage. It made short API files so much longer and inconvenient to read.

--- OLD NOTES:

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
