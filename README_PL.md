Copyright (c) 2026 Jacek Miszczuk. All rights reserved.

# Community Organiser 21 - CO21

Głównym celem aplikacji jest ułatwienie organizacji życia rodzinom i wspólnotom, a w obecnym stanie osobisty organizator wydarzeń i zadań.

Aplikacja działająca głównie offline, nawet "w statku kosmicznym odległym o lata świetlne od Internetu", nie będąca ogranioczona limitem miejsca ja w przypadku PWA, w których serwer w pewnym momencie musi zebrać dane, aby aplikacja dalej działała.

Wybrana nazwa aplikacji to CO21 - głównie skrót od Community Organiser + cyfra symbolizująca mniej więcej liczebność wspólnoty aby była do odróżnienia od wzoru chemicznego, który ma przypominać. Logo jest wstępnym projektem zrealizowanym w InkScape.

## Główne funkcje aplikacji

1. Zadania powiązane z czasem np. organizacja terminu spotkania, przypominanie o zbliżającym się spotkaniu, przypominanie o ubezpieczeniu auta czy utracie przydatności dowodu osobistego, przypominanie o zbliżającym się końcu realizacji zadania,...
2. Zadania do wykonania - nie powiązane jeszcze z czasem. Każde zadanie może być powiązane z czasem później, w prosty sposób, ale czasem potrzebna jest prosta lista zadań i podzadań. Każde zadanie tworzy w prosty sposób listę podzadań stawiając znak "-" przed podzadaniem. Taka lista może istnieć już w innym miejscu i być wklejona do aplikacji, a ta automatycznie rozpozna podzadania, nie zmieniając tekstu, dopiero po zaznaczeniu podzadania jako wykonane w tekście pojawi się odpowiedni symbol
3. Lista zakupów czy zadań wykonywanych w momencie wyczerpania zapasów. Zadania takie są oznaczane kolorami w momencie tworzenia lub edycji. Po utworzeniu np. punktu z czekoladą, można jej nadać czekoladowy kolor i co jakiś czas tylko przywracać zadanie kupna z wyszukiwarki. Zadania tego typu przyjmują bardziej minimalistyczny wygląd i widnieją na liście ogólnych zadań i wydarzeń, aby nie trzeba było sprawdzać wielu zakładek.
4. Moduł grup - konstrukcja struktury grup jest elastyczna i jedną z propozycji jest układ:
   Rodzina -> auto, dom, dziecko A, dziecko B, rodzic->hobby rodzica. Zadania wg tej struktury pojawią się według ustawień, ale do grupy Rodzina wpływają zadania z bezpośrednio podległych grup, zadania głębiej dotyczące np. hobby rodzica są bardziej ignorowane, ale przypomnienie czasowe nie będzie ignorowane
5. Moduł kalendarza - zaprojektowany aby łatwiej się orientować w odstępach czasowych, zadania cykliczne potrafią bardziej zobrazować pewną rutynę. Pojawiają się tam również święta jako obecnie niemal jedyny moduł mogący korzystać z internetu/choć nie muszący. Dane świąt pobierane są jednorazowo na 2 lata licząc od obecnego roku, później te święta są przechowywane na dysku twardym
6. Lista zadań, wydarzeń, zakupów - widok, który pozwala rozwinąć szczegóły zadań.
7. Moduł przypomnień na górze aplikacji - stała rozwijalna linia, która ma zapobiec zapominaniu, odwracaniu uwagi od wydarzeń nadchodzących.

## Kompatybilność

Obecnie aplikacja stanowi wczesną fazę rozwoju i jest testowana w obrębie rozdzielczości bliskich tabletowi i dużych ekranów, ale wiele zabiegów dąży bardzo do utworzenia widoku komórkowego, być może niewiele brakuje do generacji aplikacji Android, a w późniejszych wersjach IOS, Linux,...

## Najbliższe plany

1. Uporządkowanie kodu
2. Dokończenie synchronizacji danych Bluetooth pomiędzy urządzeniami
3. Aplikacja mobilna
4. System użytkowników i uprawnień, głównie aby wydzielić domowy tablet, na którym będzie wypisana lista/harmonogram zadań dla rodziny, bez obawy o konieczność przywracania kopii zapasowych danych.
5. Dokończenie modułu notatek, który byłby przeznaczony do gromadzenia kontaktów, tworzenia planów, odnotowania kosztów napraw auta, czy może odnotowanie miejsca przechowywania istotnych elementów gospodarstwa/małej firmy, czy też pożyczenia elementu, czy może lista opłat/składek wspólnoty - mini-skarbnik.

##Instrukcja instalacji projektu: (wygenerowana przez AI)

- **Frontend**: Quasar Framework v2 (Vue 3, TypeScript)
- **Desktop**: Electron
- **Styling**: Quasar Components
- **Data Storage**: JSON files (Electron)

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

#### Build for web

```bash
quasar build
```

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

## Data Storage

- **Desktop (Electron)**: Data is automatically saved to `%APPDATA%/community-organiser/`

## Configuration

See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js) for customization options.

## O powstawaniu kodu i designu aplikacji (Znowu ja)

Proces powstawania aplikacji mogę podzielić na etapy:

1. Wybór technologii i utwierdzenie się w przekonaniu, ze znajomy mi wcześniej framework jest przynajmniej bardzo dobrym wyborem
2. Nie miałbym może tyle motywacji do napisania tej aplikacji gdybym wcześniej nie wykorzystał AI przy tworzeniu małego projektu AI w Laravelu, który nawet się sprawdził małym nakładem pracy. Tym razem postanowiłem głównie promptami wygenerować coś nieco większego i nietypowego, przy czym zaznaczam od razu, że AI nie oszczędziło czasu w ogólnym rozrachunku, być może jej nawet dodało, za to mogłem skupić się na czymś innym niż kodowaniu.
3. Etap 3 to głównie "leniwe" wprowadzanie promptó głównie skupiając się na myśleniu o projekcie, designie, wyglądzie i funcjonalnościach użytkowych aplikacji (przeczuwając do czego to prowadzi)
4. Po pewnym etapie powstania głównych funkcjonalności nastąpiła rezygnacja z rozszerzania aplikacji o nowe funkcjonalności, a zadbanie o porzadek w aplikacji. W skrócie etap ten można nazwać Stajnią Augiasza, ale niekoniecznie mogę narzekać na samo AI tylko na wiele wspólnych czynników, które doprowadziły do tego etapu. Zajmowanie się architekturą aplikacji po napisaniu jej przez AI może też być ciekawym zajęciem, czy też logiczną łamigłówką/wyzwaniem.

## Wnioski po promptowaniu z AI:

Głównie jestem przyzwyczajony do VSCode więc ciężko byłoby nie skorzystać z rozwiązania Copilot'a choć wiem, że są lepsze rozwiązania.
ChatGPT w wersji 4 - prawie totalnie nie daje sobie rady. Większość kodu powstało przy pomocy ChatGPT5 mini, które zdecydowanie lepiej orientuje się na działaniu Vue.js.
AI pobierające większe opłaty niż miesięczny czynsz lepiej jeszcze radzą sobie z kodem, ale te w niemal równym stopniu przyczyniły się do bałaganu w kodzie, być może winnym jest zły start z ChatGPT4 i próba dostosowania się innych AI do tego stylu kodowania, ale wersja 4 dołączyła się po skończeniu się kredytów modelu Sonnet4 i 4.5 i raczej to on rozpoczął ten bałagan (ze zbyt ogólnymi komendami)

Nie poszło tak dobrze jak z projektem Laravel'a, mogę gdybać, że chodziło głównie o:

- brak wstępnych założeń projektowych, w projekcie Laravel'a od razu zainstalowałem np. moduły Nwidart , które nie są domyślnie instalowane (AI być może by znowu bałaganiło gdyby nie to, że od razu postawiłem szlaban). Moduły te znacznie potrafią poprawić przejrzystość i strukturę plików, odpowiedzialności plików

- backend w przeciwieństwie do frontendu, raczej jest stawiany jako coś bardziej biznesowego, ze swojej natury bardziej uporządkowanego, najczęściej jeszcze przenoszącym stan aplikacji np. system sesji PHP w stronę frontu. Frontend zazwyczaj odbiera dane bez stanu sesji i później te stany podlegają pod inną logikę, która najczęściej jest podkreślana jako responsywność w nowoczesnych frameworkach JavaScript.

- Vue.js ma być może mniejszą liczbę czystych przykładów w serwisach Github, ponieważ jest raczej trudniejszym w zrozumieni Frameworkiem. Samemu pamiętam, że jakikolwiek projekt frontendowy czy to Vue.js czy to jQuery wiązał się z dużym bałaganem, głównie chaotycznymi wywołaniami różnych akcji na kliknięciach i z problematycznym namierzeniem danych

- trochę powtórzę się, ale ChatGPT4 totalnie nie radził sobie z przekazywaniem danych pomiędzy komponentami, ogólnie logika wydarzeń emit, watch czy też gdzie indziej event używających tekstu string jako identyfikatora metody nie tylko powoduje chaos dla AI, ale osobiście wtedy myślę o zastąpieniu funkcjonalności innym rozwiązaniem. Podobnie postąpiłem w tym projekcie, przekształcam dalej i nie wiem ile jeszcze mi z tym zejdzie, tzw. emity i watche przenoszę w miejsce gdzie nie muszę się domyślać gdzie jest definicja funkcji/watch'a bo jest dobry do tego spis treści/index w postaci, albo centralnej konfiguracji responsywności, albo przejrzystego zarządzania/sterowania głównymi danymi. Załączam więc np. do komponentów .vue np. api.task.update zamiast zastanawiać się nad składnią emit i co ten emit ma jeszcze definiować i gdzie odbierać - wiele lat minęło i dalej do końca mnie ten system nie przekonuje. Centralny system konfiguracji i zarzadzania moim zdaniem to jedno z zalecanych rozwiązań.

- z różnych powodów AI w przypadku Vue.js i TypeScript parę razy zmieniać nazwę zmiennej importowanej z innego pliku, rozmywając pochodzenie danych funkcji, klass, fabryk, czegokolwiek. Normą również w przypadku projektu Laravela bez poprawek jest wywoływać po 7x inicjację projektu, wielokrotnie powtarzać generację zmiennych kopiując kod zamiast centralizować, ale trzeba wiedzieć i zauważyć tego typu rzecz.

- Można winić w wielu przypadkach za niepowodzenia limity AI, ale upartość AI też odgrywa rolę. Ta upartość może się brać z kopiowania praktyk z repozytorów Github. Wydawanie konkretnych poleceń, szczegółowych dalej może prowadzić AI do ignorowania wytycznych, dopiero w momencie gdy AI zobaczy, że w projekcie pojawiła się klasa/wzorzec programistyczny, dużo chętniej naśladuje podpatrzony kod. Refaktoryzacja kodu z AI bywa z tego powodu dość utrudniona, ale możliwa, nauka wydawania instrukcji AI też może w jakiś sposób popłacać, a przynajmniej poznanie jej limitów i w tej chwili, nawet się nie zastanawiam nad niektórymi rzeczami, które AI potrafią zejść 10 minut + wycofa się zmiany cofając stan w GIT i od nowa,..., gdy samemu zrobi się coś w pół minuty - są tego typu sytuacje gdy AI miewa większe problemy. Głównie warto samemu przenosić kod html i samemu wporawdzać/przenosić składnię v-if, samemu zmieniać nazwy zmiennych, samemu poprawiać drobiazgi po generacji AI - gdy te zamiast postawić klamerki we właściwym miejscu woli wycofać zmiany w GIT po 20-sty próbach.

- nie mogę całkowicie krytykować AI, ale nie mogę też ukrywać, że jest ryzyko. To ryzyko bym opisał jak branie ciężarówki na kredyt z niepewnym oprocentowaniem. Wiadomo, że kredyt pochłonie więcej pieniędzy niż gdyby wstrzymać się kupnem do momentu uzbierania pieniędzy. Jednak auto na kredyt może zarabiać na siebie, a kredyt niekoniecznie trzeba w ogóle spłacać, gdy ciężarówka to wszystko co ma mieć do zaproponowania aplikacja. Problem się może pojawić jeśli do ciężarówki trzeba dodać integrację z logistyką, GPS, im więcej będzie się dokładało do ciężarówki tym większe ryzyko będzie, że aplikacja zamuli, albo dodając jedną funkcjonalność przestanie działać inna, albo projekt jest na tyle duży, że trzeba kogoś kto zna kod działania ciężarówki, żeby móc coś dopisać, co może być drogie w rozwoju.
  Koszty rozwoju aplikacji AI raczej są tanie na początku dużo droższe na końcu, ... ale bywa też tak nieraz z ludzkim kodem.

- w moim przypadku dochodzem z ciężkiej refaktoryzacji, jest chęć większa chęć do poznania architektury, praktyk, utrzymania kodu. Jeszcze nie przetestowałem jeszcze wszystkich opcji AI do generacji czy refaktoryzacji. Patrząc się na jakikolwiek kod AI brudny czy czysty można podłapać kilka fajnych trików, nauczyć się w ogóle metod rozwiązań jak coś może działać.

- kod zmieniał wielokrotnie podczas refaktoryzacji postać i w miarę aplikacja nadal działa bez potrzeby wykorzystania modułu backup. Spagetti kod generowany praktycznie jednym ciągiem przez AI może razić, z drugiej strony ten bałagan można wrzucić do coraz mniejszych worków, sortować,... ale czasem się można zastanawiać, czy nie traktować tego bałaganu jak piasek na plaży obok domku na plaży, a czy bardziej jak piasek w butach.

- AI samo raczej nie wpada na pomysły, które by usprawniły działanie kodu, np. zamiast pobierać wszystkie zdania z jednej listy, wolało przefiltrować zadania wg. skrajnych dat, ale to błąd, który można później naprawić, gdy reszta kodu może wydawać się bez większego zarzutu.

- Generatywne problemy AI to głównie brak centralizacji/tworzenia mapy danych podobnie w kodzie jak w grafice. AI lubi czasem bardziej generować nadmierny kod zamiast podłączać, co niekoniecznie jest złe i łatwiej jest jej nie generować gdy AI ma prostą listę funkcjonalności.

- projekt prawdopodobnie będzie stanowił część bloga czy vlog'a odnośnie ogólnie tematyki AI, tam postaram się o bardziej konkretne przykłady

- zanim projekt zostanie opublikowany w wersji produkcyjnej, zostanie dokładnie sprawdzony, zwłaszcza kluczowe funkcjonalności dotyczące utraty/przywracania danych oraz opcjonalnej komunikacji pomiędzy urządzeniami Bluetooth czy opcjonalna konfiguracja serwera backendowego/wtyczki WordPress do tego celu,...

- a aplikacja całkowicie w trybie Offline będzie w podobnym stopniu narażona jak użycie notatnika, czy kalkulatora. Warto łączyć się tylko ze znajomymi, ale i tak wiele osób się spotkało z rozsyłaniem dziwnych wiadomości przez "znajomych" w popularnych serwisach społecznościowych, którzy wcale tych wiadomości nie wysyłali.

## O licencji i planach dystrybucyjnych pełnej wersji:

- do czasu wydania pełnej w miarę wersji wstrzymuję się z decyzją o wyborze licencji dając ogólne prawa bardziej w stylu Read Only.

- podstawowa aplikacja Offline raczej będzie darmowym rozwiązaniem, z możliwością rozszerzenia o płatne usługi, czy też zarabiające na utrzymanie serwerów w postaci wyświetlanych reklam. Przykładowymi usługami mogą być np. rozsyłanie maili, synchronizacja danych Online, bez konieczności konfiguracji własnego serwera,...
