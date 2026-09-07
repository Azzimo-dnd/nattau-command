# Barovia / Nattau — przegląd i przygotowanie sesji

Stan przeglądu: 7 września 2026. Gałąź robocza: `feat/vtt-alpha`. Zmiany obejmują także wcześniejsze prace `feat/vtt-tabletop-polish` i `feat/vtt-fog`.

## Zakres i wcześniejsze ustalenia

Companion pozostaje jednym projektem technicznym z osobnymi kampaniami. Nattau zachowuje ekspedycję, system D&D, inicjatywę i Cenę Azzimo. Barovia używa Daggerheart, Tarokki, Mgły i oprawy gotyckiej. Gracze pozostają obserwatorami VTT z możliwością pingowania; figurkami, widocznością scen i podpisami zarządza MG. Materiały fabularne Barovii i przebieg kampanii nadal mogą być prowadzone w osobnym projekcie rozmów.

Nie zmieniono zasad osobistych losowań między sesjami, nie zresetowano kart ani terminów, nie opublikowano nowych scen i nie wysłano zaproszeń do graczy.

## Co jest dostępne w obu kampaniach

| Funkcja | Nattau | Barovia |
| --- | --- | --- |
| Pulpit i nawigacja | Centrum ekspedycji | Gotycki pulpit, termin i skróty przygotowania |
| Sesje | Planner, termin, wiadomość, Cena Azzimo | Planner, termin, wiadomość, uzgodnione ślady Mgły |
| Współpraca | Council / czat | Whispers |
| Mapy | Mapa archipelagu | Atlas of the Mists |
| Los | Dotychczasowe karty | Osobista Tarokka i wielka wróżba MG |
| Miniatury | Galeria, przydziały, malowanie | Lost Souls, przydziały i malowanie w obrębie Barovii |
| Modele przeciwników | Biblioteka MG i malowanie | Creatures of the Mists i malowanie |
| VTT | Siatka D&D, inicjatywa, mgła, sceny, skład drużyny, pomiary | Te same narzędzia, ręczny spotlight i pomiar w kratkach jako pomoc narracyjna |
| Rzuty na VTT | Zestawy kości, przewaga/utrudnienie k20 | Nadzieja/Strach 2k12, ±k6, wynik krytyczny, osobny skrót k20 przeciwnika |
| Minigry | Pięć dotychczasowych mechanizmów | Te same pięć mechanizmów z odrębną oprawą i znakami |

Barovia korzysta ze wspólnych komponentów zabezpieczonych członkostwem i rolą MG. Linki galerii, malarni i pracowni prowadzą do aktualnej kampanii. Moduły militarne i rozliczanie wsparcia ekspedycji pozostają przypisane do Nattau.

## Poprawki VTT

- Odczyty miniaturek przez tabelę, RPC i prywatne pliki przeciwników uwzględniają mgłę oraz widoczność sceny. Samo ukrycie w interfejsie wcześniej nie zabezpieczało bezpośrednich odczytów tabeli.
- Mgła po stronie klienta i PostgreSQL używa tej samej pozycji środka figurki po dopasowaniu do siatki. Testowane są również parzyste/nieparzyste wymiary i różne rozmiary stworzeń.
- Publiczne kanały VTT zastępują prywatne kanały z kontrolą członkostwa. Edycję mgły nadaje MG. Rzuty współdzielone trafiają do kanału konkretnej sceny. Rzuty w scenie przygotowywanej lub ukrytej pozostają lokalne dla MG i w chronionej historii tej sceny.
- Po ponownym połączeniu lub powrocie do karty odświeżane są scena, figurki i mgła. Opóźnione odpowiedzi dotyczące poprzedniej sceny nie podmieniają aktualnego stołu.
- Widok gracza czeka na załadowanie mgły przed pokazaniem figurek. Podgląd MG uwzględnia ukrycie całej sceny i zapisaną kalibrację mapy; ukrywa też panel MG z nazwami nieujawnionych przeciwników.
- Kopia sceny zachowuje mapę, kalibrację, figurki, skład drużyny i kolejność operacji mgły. Powstaje jako nieaktywna i ukryta; częściowa awaria jest zgłaszana i sprzątana.
- Samo otwarcie VTT przez MG nie tworzy już automatycznie aktywnej sceny. Nową scenę tworzy się świadomie jako przygotowywaną i ukrytą.
- Ruch i obrót figurki nie uruchamiają ponownie ładowania modelu. Współdzielone geometrie są zwalniane po opuszczeniu sceny. Zachowano dotychczasową korektę orientacji miniaturek. Po błędzie pobierania mapy lub modelu można ponowić ładowanie przyciskiem Retry assets.
- Pasek inicjatywy / spotlight nie wypisuje przeciwników niewidocznych dla gracza. Rzuty i lokalne stany interfejsu są rozdzielone między scenami.

Mgła jest narzędziem ujawniania sceny, a nie szyfrowaniem mapy: klient pobiera obraz mapy, aby go wyrenderować. Osoba analizująca pobrane zasoby może obejrzeć cały obraz. Nie umieszczaj tajnych notatek ani oznaczeń MG w udostępnianym pliku mapy. Już ujawnionych lub pobranych informacji nie da się odebrać graczowi przez ponowne zakrycie.

## Minigry

| Mechanizm | Barovia |
| --- | --- |
| Rune Cipher | The Mourner's Seal — znaki żałobnej pieczęci |
| Sliding Lock | The Iron Reliquary — srebrny klucz i żelazne zapory |
| Shattered Sigil | The Broken Vigil — odtwarzanie ochronnego znaku |
| Arcane Circuit | The Last Lantern — prowadzenie ostatniej iskry |
| Rune Sequence | Echoes Behind the Door — zapamiętywanie niepokojących znaków |

Dodano oryginalne teksty wprowadzenia, sukcesu i porażki oraz znaki kruka, ciernia, świecy, księżyca, klucza, dzwonu, lustra i róży. Losowe warianty nadal mają rozwiązania. Rune Sequence pokazuje teraz rysunki znaków, a wielokrotne kliknięcie nie uruchamia równoległych pokazów sekwencji.

## Stan usług podczas audytu

- GitHub: prace VTT były rozdzielone pomiędzy gałęzie alpha, tabletop-polish i fog; zostały zebrane na alpha, bez scalania do `master`. Publikacja zmian odbywa się w repozytorium `Azzimo-dnd/nattau-command`, na gałęzi `feat/vtt-alpha`, w ramach [roboczego PR #3](https://github.com/Azzimo-dnd/nattau-command/pull/3).
- Supabase: projekt był aktywny i zdrowy. Schemat zawierał VTT do v0.4.8 i RLS na wszystkich 43 publicznych tabelach. Po zatwierdzeniu przez użytkownika zastosowano migrację `barovia_vtt_session_readiness` w wersji `20260907141320`; potwierdzono jej wpis w historii i nowe polityki prywatnych kanałów VTT.
- Barovia miała dwa aktywne członkostwa, zero scen VTT i zero zapisanych zagadek. Przeniesienie narzędzi nie oznacza jeszcze przygotowanego konkretnego spotkania ani zaproszenia pozostałych chętnych graczy.
- Vercel: istniejący preview VTT był READY; w odczytanym oknie siedmiu dni nie było zgłoszonych błędów runtime. Środowiskiem docelowym nowych zmian jest preview gałęzi `feat/vtt-alpha`; aktualny deployment jest dostępny w kontrolach PR #3. Pełnego działania uwierzytelnionego MG i gracza na współdzielonej bazie nie należy uznawać za zweryfikowane samym statusem deploymentu.
- Doradca Supabase wskazywał pięć funkcji triggerów bez stałego `search_path` oraz wyłączoną ochronę haseł ujawnionych w wyciekach. Pozostały osobnymi punktami utrzymaniowymi; brak polityk w niektórych tabelach obsługiwanych wyłącznie przez autoryzowane RPC nie jest automatycznie luką.

## Wdrożenie i kontrola przed sesją

Zastosowana migracja: `supabase/migrations/20260907141320_barovia_vtt_session_readiness.sql`. Plik utworzono przez Supabase CLI, a numer zsynchronizowano z wersją nadaną przy wdrożeniu do Supabase. Migracja jest zgodna z istniejącym schematem v0.4.8 i nie zmienia danych kampanii. Została zastosowana przed publikacją klienta używającego prywatnych kanałów. Repozytorium zawiera historyczne skrypty SQL poza katalogiem `migrations`; nie należy resetować bazy ani zakładać, że pusty lokalny projekt odtworzy z tego pełną historię przez samo `db push`.

Preview i produkcja korzystają z jednej bazy. Użytkownik zatwierdził tę migrację i publikację gałęzi roboczej 7 września 2026. Scalenie do `master` i publikacja aplikacji produkcyjnej pozostają osobną decyzją.

Przed sesją:

1. W Barovia → członkowie sprawdź skład i przydziel aktualną rolę każdemu uczestnikowi. Wybierz na daną scenę 5–6 obecnych postaci; nieobecność pozostałych pozostaje motywem Mgły.
2. W The Next Gathering ustaw rzeczywisty termin i wiadomość; nie rozpoczynaj nowej sesji tylko w celu przetestowania licznika, bo wpływa to na cykl losowań.
3. W Lost Souls / Miniature Studio przypisz modele. Przygotuj przeciwników w Creatures of the Mists.
4. Utwórz scenę, wgraj mapę, skalibruj siatkę i wybierz obecne postacie. Włącz mgłę, zakryj całość, odkryj wejście i sprawdź Player preview.
5. W Relic Workshop wygeneruj wybrane zagadki Barovii, sprawdź podglądy i użyj prywatnego testu. Ujawniaj dopiero podczas sesji.
6. Otwórz preview jako MG oraz w osobnej przeglądarce jako zwykły gracz Barovii. Sprawdź pokazanie/ukrycie sceny, reveal/cover/undo mgły, ping, spotlight, rzut Nadziei/Strachu i trwałą historię.
7. Przełącz na Nattau i sprawdź dotychczasowe podpisy, inicjatywę, mapę i Cenę Azzimo. Nie powinny pojawić się dane Barovii.

## Walidacja i źródła

`npm test` obejmuje 13 testów: prawdziwy PostgreSQL w PGlite z RLS, zgodność geometrii SQL/JS, dostęp gracza/MG/obcego członka kampanii/anonima, prywatne tematy Realtime, ponowne zastosowanie migracji, rzut Duality i pięć typów zagadek na czterech poziomach trudności dla obu kampanii.

`npm run build` przechodzi na Next.js 16.3.4. `npm audit --omit=dev` po aktualizacji: zero zgłoszonych podatności. Zmienione pliki przechodzą ESLint; pełny projekt ma 41 wcześniejszych błędów i 9 ostrzeżeń w pozostałych modułach, głównie dotyczących istniejących hooków React. Globalnych reguł lintowania nie wyłączono.

Przeglądarka Chromium uruchomiła rzeczywiste komponenty React, stół Three.js i fizykę kości na syntetycznych danych. Sprawdzono narzędzia MG, podgląd gracza bez nazw ukrytych przeciwników, widok obserwatora, ukrycie i ponowne pokazanie sceny w dwóch kartach oraz fizyczny rzut Nadziei/Strachu z przewagą. Zagadki obu kampanii sprawdzono również przy szerokości 390 px: bez poziomego przewijania strony i bez wyjątków JavaScript. Test ten używał lokalnego zastępstwa Supabase; nie potwierdza jeszcze komunikacji dwóch uwierzytelnionych kont z usługą Realtime ani trwałego zapisu w zdalnej bazie.

Osobna próba na rzeczywistym buildzie produkcyjnym (`next start`) potwierdziła przekierowanie niezalogowanej osoby do logowania z `/campaigns/barovia/vtt`, `/campaigns/barovia/gm/session` i `/vtt`, bez wyjątków JavaScript w przeglądarce.

Po wdrożeniu migracji wykonano 13 sprawdzeń autoryzacji w zdalnej bazie, używając istniejących członkostw MG, gracza Barovii i gracza należącego wyłącznie do Nattau. Potwierdzono dostęp do właściwych tematów, nadawanie mgły wyłącznie przez MG, odrzucenie obcej kampanii i anonimowych RPC. Próba działała w transakcji tylko do odczytu zakończonej rollbackiem; nie zmieniła danych ani sesji użytkowników. Nie zastępuje próby dwóch zalogowanych przeglądarek przez usługę Realtime.

Mechanikę Duality, przewagi/utrudnienia i spotlight sprawdzono w [oficjalnym SRD Daggerheart](https://www.daggerheart.com/srd/). Gotyckie opisy są oryginalne i nie ujawniają rozwiązań fabularnych Curse of Strahd. Prywatne kanały oparto o [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization). Aktualizacja Next.js odpowiada na [opublikowane advisory](https://github.com/advisories/GHSA-6gpp-xcg3-4w24) i korzysta z [wydania 16.3.4](https://github.com/vercel/next.js/releases/tag/v16.3.4).
