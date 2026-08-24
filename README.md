# Wish Studio

GitHub Pages-д шууд байрлуулах нэг файлтай website.

## GitHub-д оруулах

1. GitHub дээр шинэ repository үүсгэнэ.
2. Энэ хавтасны `index.html` файлыг repository-ийн үндсэн хэсэгт upload хийнэ.
3. `Settings` → `Pages` руу орно.
4. `Deploy from a branch` → `main` → `/ (root)` сонгоод `Save` дарна.
5. Хэдэн минутын дараа GitHub Pages-ийн link гарна.

## Cloud backend

Төсөл Supabase Auth, Postgres database, Row Level Security болон Storage ашиглана. Хэрэглэгчийн бүртгэл, мэндчилгээ, төлбөр, зураг болон видео browser-оос хамаарахгүйгээр cloud-д хадгалагдана.

Database бүтцийг `supabase/migrations/001_initial.sql` файлаас үүсгэнэ. Admin эрхийг нууц кодоор бус `profiles.is_admin` талбараар хамгаална.
