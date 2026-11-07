# Barovia — GM Session Desk

Wejście: **Game Master → GM Session Desk** albo skrót na stronie głównej Barovii.

| Widok | Zastosowanie |
| --- | --- |
| Overview | Opublikowany termin i notatki, bieżący cykl Tarokki, odpowiedzi graczy, stan omenów oraz głosowania. |
| Availability & votes | Wspólny kalendarz Barovii, porównanie dostępności, propozycje, potwierdzanie i anulowanie terminów. |
| Session announcement | Dokładna data i godzina, komunikat oraz Marks of the Mists; podgląd i publikacja. |
| Tarokka control | Current Turning, talia, historia i Grand Reading, z dotychczasowymi potwierdzeniami zmian cyklu i korekt. |

Panel i bezpośrednia strona `/campaigns/barovia/gm/tarokka` wymagają członkostwa GM w Barovii. Zwykli gracze korzystają nadal z The Gathering i swojej strony Tarokki. Wejście GM na dawny adres Tarokki prowadzi do Tarokka Control.

Przegląd planowania dotyczy pozostałych dni i otwartych głosowań w bieżącym miesiącu kalendarzowym w Europe/Warsaw. Kolejne miesiące wybiera się w kalendarzu. Wpis „unavailable” jest odpowiedzią, więc gracz, który zaznaczył brak dostępności, nie jest pokazywany jako osoba bez odpowiedzi.

Liczniki planowania używają kampanijnego `planning_enabled`, a postęp omenów — `counts_toward_campaign_progress`. Konta testowe mogą pozostać na liście, z wyraźnym oznaczeniem wykluczenia z odpowiednich sum. Brak odczytu jest pokazywany jako niedostępność danych, a nie zerowy postęp. **Refresh overview** pobiera nową migawkę po zmianach innych osób.

Wybranie terminu i publikowanie ogłoszenia korzystają z dotychczasowych funkcji. Otwarcie nowego Turning jest osobną, potwierdzaną czynnością w Tarokka Control; historia i dotychczasowe reguły korekt pozostają dostępne. Opublikowanie terminu nie resetuje omenów.

Zmiana nie wymaga migracji bazy. Odczyty używają istniejącego klienta z sesją użytkownika, polityk RLS i RPC z kontrolą kampanii. Nie wprowadza klucza administracyjnego ani nowej ścieżki zapisu.

Testy regresji obejmują odrębne flagi uczestnictwa, konta testowe, głosy GM/obcych osób, przeterminowane dane, stare cykle, błędy odczytu oraz granice miesiąca i czasu letniego w Warszawie. Dotychczasowe testy PostgreSQL/RLS Tarokki nadal obejmują autoryzację i izolację kampanii.
