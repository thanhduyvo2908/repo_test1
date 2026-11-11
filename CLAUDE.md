# Xidle

Game web thu thập nhân vật anime crossover: người chơi đi qua các World chia theo cốt truyện, trận đấu chạy tự động, hạ boss để chiêu mộ nhân vật và nhặt item. Cấu trúc World và map lấy Poke'Catch (https://pokecatch-online.netlify.app/) làm mẫu. Dự án một người.

Trả lời người dùng bằng tiếng Việt. Code, tên biến, comment và commit viết bằng tiếng Anh.

Kế hoạch nội dung từng World nằm ở file riêng. Đọc `docs/world-1.md` khi làm map, lính, boss hoặc item của World 1.

## Phạm vi bản đầu (v1)

Đã chốt với người dùng:

- 1 World là One Piece, gồm 12 map.
- Luffy là nhân vật mặc định: mọi người chơi bắt đầu với Luffy.
- Chỉ có PvE.
- Khắc chế bằng 7 hệ nguyên tố. Chưa có vai trò (role).
- Nâng sao cần đủ hai điều kiện: đã mở mốc cốt truyện cố định của nhân vật đó, và đủ nguyên liệu.
- Có thưởng offline.
- Game có hai ngôn ngữ: tiếng Anh là mặc định, tiếng Việt là lựa chọn thứ hai.

Ngoài phạm vi v1, không xây trước: PvP RTA, tài khoản và server, World Naruto và Dragon Ball.

## Cấu trúc thế giới

- World gồm nhiều map, đi theo thứ tự cốt truyện.
- Mỗi map có 10 đến 15 màn nhỏ đánh lính và đúng 1 boss. Không có tinh anh.
- Cơ chế cốt lõi là idle, giống Poke'Catch: màn nhỏ đánh lại được không giới hạn để grind vàng và food. Không có thể lực hay giới hạn lượt chơi.
- Lính của mỗi map lấy theo bối cảnh truyện của map đó. Lính không chiêu mộ được.
- Hạ boss thì có tỉ lệ chiêu mộ chính boss đó và có thể rơi item trấn phái của boss đó. Lần hạ đầu tiên không được bảo đảm chiêu mộ, và không có bảo hiểm tỉ lệ.
- Tỉ lệ chiêu mộ khai báo theo World, từng boss có thể ghi đè. Nhân vật đã có thì không chiêu mộ lại. Không có mảnh nhân vật.
- Màn thông tin map cho người chơi xem trước: lính và hệ của chúng, boss cùng hệ, level và toàn bộ skill kèm mô tả, item boss rơi, tỉ lệ chiêu mộ. Người chơi đọc ở đây để tìm cách khắc chế boss, nhất là khi boss có mechanic riêng.
- Độ khó: map và lính không được quá dễ; qua map phải cần đầu tư vào level, item và đội hình khắc hệ. Yêu cầu này áp dụng từ World 2. World 1 không nên quá khó.

## Hệ nguyên tố

- Có 7 hệ: Kim, Mộc, Thủy, Hỏa, Thổ, Ánh sáng, Bóng tối. Trong code: `metal`, `wood`, `water`, `fire`, `earth`, `light`, `dark`.
- Mỗi nhân vật, kể cả lính và boss, có đúng 1 hệ.
- Năm hệ cơ bản là Kim, Mộc, Thủy, Hỏa, Thổ.
- Ánh sáng và Bóng tối nằm ngoài năm hệ cơ bản và khắc lẫn nhau.

## Nhân vật và chiến đấu

- Nhân vật có 6 chỉ số (HP, công vật lý, công phép, thủ vật lý, thủ phép, tốc độ), 1 hệ, 1 passive, một danh sách skill, 1 ô item và cấp sao.
- Mỗi chỉ số gồm phần cố định theo nhân vật, level và sao, cộng phần người chơi tự phân bổ.
- Skill mở theo level, ở các mốc 1, 20, 30 và 50. Nhân vật mang tối đa 4 skill. Người chơi xếp thứ tự ra chiêu trước trận; trong trận không có thao tác nào.
- Skill được thiết kế dựa trên hoạt ảnh có sẵn trong sprite của nhân vật, để tận dụng thiết kế sẵn. Claude được tự đề xuất và bổ sung skill khi cần, gắn nhãn **Đề xuất** cho tới khi người dùng duyệt. Người dùng duyệt bản cuối. Bản thiết kế từng nhân vật nằm ở `docs/characters/<id>.md`. Nhân vật chưa có bản thiết kế thì dùng skill placeholder.
- Giới hạn level tăng theo World. Ở World 1 giới hạn là 30.
- Lên sao không chỉ tăng chỉ số: mỗi cấp sao còn thay đổi nội dung skill và thêm hiệu ứng mới.
- Đội người chơi tối đa 5 nhân vật, theo thứ tự người chơi xếp sẵn.
- Màn nhỏ đánh 1 đấu 1 như Poke'Catch: mỗi bên ra sân từng người theo thứ tự, đội địch có từ 1 đến 5 NPC. Nhân vật gục thì người kế tiếp ra sân; bên nào hết người trước thì thua.
- Trận boss đánh 5 đấu 1: cả đội cùng đánh một boss.
- Không có hàng trước, hàng sau.
- Vàng và food dùng để lên level. Nguyên liệu nâng sao đến từ ải phụ.

## Khung chiến đấu

Đã chốt với người dùng ngày 11/11/2026.

### Chỉ số

- 6 chỉ số trùng với 6 chỉ số của Pokémon: HP, công vật lý (Atk), thủ vật lý (Def), công phép (SpA), thủ phép (SpD), tốc độ (Spe).
- Mỗi nhân vật khai báo 6 base stat. Tổng base stat tự đặt theo từng nhân vật, không bắt buộc bằng nhau.
- Chỉ số theo level dùng công thức Pokémon, không có IV và nature:
  - Chỉ số = 2 × base × L / 100 + 5
  - HP = 2 × base × L / 100 + L + 10
- Mỗi điểm tự nâng cộng 0,5 vào chỉ số thường và 1 vào HP. Hai giá trị này nằm trong cấu hình cân bằng.
- Mỗi cấp sao khai báo số base stat cộng thêm cho từng chỉ số của nhân vật đó.
- Ví dụ: base 100 ở level 30 cho chỉ số 65 và HP 100. Dồn 30 điểm thì chỉ số thành 80 và HP thành 130.

### Skill và cách ra chiêu

- S1 và S2 có hồi chiêu, tính bằng số vòng. S3 và S4 chỉ dùng được 1 lần mỗi trận. Ở màn nhỏ, một trận là cả màn, gồm mọi lính trong màn.
- Mỗi nhân vật có thêm 1 đòn đánh thường, không có hồi chiêu và không tính vào 4 skill. Đòn đánh thường khai báo trong dữ liệu nhân vật.
- Phần mở đầu: nhân vật dùng lần lượt mỗi skill đã mở một lần, theo thứ tự người chơi xếp.
- Sau phần mở đầu, mỗi lượt nhân vật dùng skill đã hồi xong đứng trước nhất trong thứ tự xếp. Nếu S1 và S2 đều đang hồi thì dùng đòn đánh thường.
- Mỗi skill khai báo chỉ số mà nó tăng theo, kèm trọng số, tùy chất của nhân vật. Ví dụ nhân vật thiên phòng thủ có skill tăng theo thủ hoặc HP.
- Loại sát thương (vật lý hay phép) khai báo theo nhân vật: mọi skill và đòn đánh thường của một nhân vật cùng một loại.
- Mỗi skill khai báo mục tiêu (một địch, nhiều địch, bản thân, đồng minh). Lý do: sau v1 sẽ có PvP RTA đánh 5 đấu 5, nên có nhân vật hợp PvE với skill đơn mục tiêu và có nhân vật hợp PvP. Không xây PvP trong v1; chỉ để dữ liệu skill có sẵn trường mục tiêu.

### Vòng và tốc độ

- Trận đánh theo vòng. Mỗi vòng, mọi nhân vật đang trên sân hành động đúng 1 lần, tốc độ cao hơn đánh trước.
- Thứ tự tính lại ở đầu mỗi vòng, nên hiệu ứng tăng giảm tốc độ có tác dụng từ vòng sau.

### Công thức sát thương

Lấy theo công thức của Pokémon VGC:

```
ST = ((2 × Level / 5 + 2) × Power × A / D / 50 + 2)
     × chí mạng × ngẫu nhiên × STAB × khắc hệ × nhiều mục tiêu × hiệu ứng khác
```

- `Level`: level của người đánh. `Power`: sức mạnh của skill hoặc đòn đánh thường.
- `A`: tổng các chỉ số mà skill tăng theo, nhân trọng số.
- `D`: thủ vật lý hoặc thủ phép của mục tiêu, theo loại sát thương của người đánh.
- Chí mạng: có tỉ lệ và hệ số cơ bản, skill và item có thể tăng. Chí mạng không phải chỉ số thứ 7 nên không phân bổ điểm vào được.
- Ngẫu nhiên: nhân với một số từ bộ sinh số có seed.
- STAB: skill cùng hệ với nhân vật được nhân thêm.
- Khắc hệ theo mức của Pokémon: khắc thì nhân 2, bị khắc thì nhân 0,5.

## Item trấn phái

Hoạt động giống Artifact của Epic Seven.

- Mỗi boss có một item riêng, chỉ rơi từ boss đó. Item có 4 bậc: Thường, Hiếm, Sử thi, Huyền thoại (trong code: `common`, `rare`, `epic`, `legendary`).
- Mỗi nhân vật mang 1 item. Nhân vật nào cũng mang được item nào.
- Mỗi item có một hiệu ứng viết cho nhân vật chủ, nên mạnh nhất trên chủ. Nhân vật khác thỏa điều kiện của hiệu ứng vẫn hưởng. Ví dụ của người dùng: Mũ rơm của Luffy tăng sát thương vật lý cho skill hệ Thổ, với giả định Luffy hệ Thổ và đánh bằng công vật lý.
- Độ mạnh của hiệu ứng tăng theo bậc. Theo ví dụ trên: Huyền thoại tăng 30%, Hiếm tăng 10%.
- Item phân rã được thành bụi (dust): Thường 1, Hiếm 2, Sử thi 5, Huyền thoại 10.
- 50 bụi đổi được 1 item bậc Huyền thoại do người chơi chọn.
- Item của nhân vật khởi đầu không rơi từ boss. Mũ rơm của Luffy được tặng thẳng ở bậc Huyền thoại khi người chơi hoàn thành World 1.

## Hai ngôn ngữ

- Mọi chuỗi người chơi nhìn thấy đi qua bảng chuỗi theo khóa, có bản `en` và `vi`. Không viết chuỗi thẳng vào component.
- Tên và mô tả trong gói nội dung (nhân vật, skill, passive, item, map, lính) đều có đủ `en` và `vi`.
- Ngôn ngữ mặc định là `en`. Thiếu bản dịch `vi` thì hiển thị bản `en`.
- Lựa chọn ngôn ngữ của người chơi được lưu cùng file lưu.
- Nhật ký trận chỉ chứa dữ liệu sự kiện, không chứa câu chữ. Giao diện ghép câu theo ngôn ngữ đang chọn.
- Có test kiểm tra mọi khóa trong bảng chuỗi và mọi mục trong gói nội dung có bản `en`.

## Kiến trúc

Stack: TypeScript, Vite, React cho giao diện, PixiJS v8 cho cảnh chiến đấu, Vitest cho test. Triển khai dạng trang tĩnh.

```
src/core/      luật chơi thuần TypeScript: mô phỏng trận, tiến trình, rơi đồ, thưởng offline
src/content/   kiểu dữ liệu, schema và bộ nạp gói nội dung
src/i18n/      bảng chuỗi en và vi, hàm tra chuỗi
src/ui/        màn hình React
src/render/    cảnh chiến đấu PixiJS, chỉ phát lại nhật ký trận
src/save/      lưu, tải, migration
packs/         gói nội dung: dữ liệu và asset
tools/         script nhập asset và mô phỏng cân bằng
docs/          kế hoạch nội dung từng World
```

Quy tắc:

- `src/core/` không import React, PixiJS hay DOM. Trong `src/core/` không gọi `Math.random()` hay `Date.now()`; bộ sinh số ngẫu nhiên có seed và thời gian hiện tại được truyền vào làm tham số.
- Mô phỏng trận nhận đội hình và seed, trả về kết quả cùng nhật ký sự kiện. Cùng đầu vào phải cho cùng nhật ký. Giao diện phát lại nhật ký và không tự tính sát thương.
- Engine không biết tên nhân vật nào. Nhân vật, skill, item, map, lính, boss và nhân vật khởi đầu là dữ liệu trong gói nội dung, được kiểm tra bằng schema khi nạp.
- Bảng khắc hệ là dữ liệu trong cấu hình cân bằng, không viết thành chuỗi `if` trong code.
- Hiệu ứng item là dữ liệu: một điều kiện (hệ của skill, loại sát thương) và một hiệu ứng có giá trị theo bậc. Không viết code riêng cho từng item.
- Cấp sao là dữ liệu: mỗi cấp sao của một nhân vật khai báo mức tăng chỉ số, phiên bản skill và hiệu ứng thêm. Không viết code riêng cho từng nhân vật.
- Mọi con số cân bằng (tỉ lệ rơi, tỉ lệ chiêu mộ, mốc mở skill, giới hạn level, hệ số khắc hệ, chi phí lên level, giới hạn lượt, số bụi) nằm trong file cấu hình cân bằng của gói nội dung. Không đặt hằng số cân bằng trong code.
- File lưu có số phiên bản. Đổi cấu trúc dữ liệu lưu thì viết migration kèm test.

## Gói nội dung và asset

- `packs/placeholder/` là gói mặc định và được commit. Nhân vật là hình khối trung tính với tên chung. Game và toàn bộ test phải chạy được chỉ với gói này.
- `packs/onepiece/` chứa dữ liệu World 1. Sprite ưu tiên lấy từ nhân vật MUGEN do cộng đồng làm. Nhân vật không có bản MUGEN dùng được thì lấy sprite sheet rip từ game One Piece trên GBA (spritedatabase.net), rồi chỉnh tỉ lệ và bảng màu cho khớp. Nguồn từng nhân vật ghi ở `docs/characters/sprite-sources.md`. Không commit sprite và file MUGEN gốc vào git; giữ chúng trong `.gitignore`.
- Người dùng tự tải sprite về. Claude tìm và đưa link, tác giả, điều kiện dùng lại, nhưng không tự tải file.
- Nguồn thô đặt ở `assets-raw/<nhân-vật>/`. Nhân vật MUGEN gồm `.def`, `.sff`, `.air`, `.cmd`, `.cns` và readme của tác giả; nhân vật GBA là một file sheet `.gif` hoặc `.png`. Script trong `tools/` chuyển chúng thành atlas PNG, JSON animation và bản nháp moveset.
- Mỗi nhân vật nhập vào có một dòng trong `CREDITS.md`: tác giả, nguồn và điều kiện dùng lại ghi trong readme.
- Nếu các bộ sprite lệch nhau về kích thước hoặc nét vẽ, Claude được chỉnh lại sprite có sẵn: đổi tỉ lệ, căn chỉnh, đổi bảng màu.
- Không tạo mới hoặc vẽ lại hình nhân vật có bản quyền. Thiếu sprite thì dùng placeholder và báo cho người dùng.

## Lệnh và kiểm tra

Repo khởi tạo ngày 11/11/2026, dùng Node 26, TypeScript 7, Vite 8, React 19, Vitest 5 và zod 4 cho schema.

- `npm run dev`: chạy bản phát triển. `.claude/launch.json` có cấu hình `dev` ở cổng 5173 để mở trong trình duyệt của app.
- `npm test`: chạy Vitest
- `npm run typecheck`
- `npm run sim`: mô phỏng hàng loạt trận để kiểm tra cân bằng. Cho nhân vật khởi đầu đánh một mình mọi màn và boss của mọi map, in tỉ lệ thắng, số vòng và HP còn lại theo từng level. Tùy chọn: `-- --runs 500`, `-- --levels 1,3,5`.
- `npm run build`

Node và Git được cài bằng winget sau khi app đã chạy, nên shell của app có thể chưa có chúng trong PATH. Nếu `node` hoặc `git` báo không tìm thấy, chạy dòng này trong cùng lệnh: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.

Sau khi sửa `src/core/`, chạy `npm test` và `npm run typecheck` trước khi báo hoàn thành. Sau khi sửa giao diện, mở game trong trình duyệt và chụp màn hình ở chiều rộng 400px, ở cả hai ngôn ngữ, để kiểm tra. Nếu skill `pixijs-*` và `webapp-testing` đã được cài, dùng chúng khi làm `src/render/` và khi kiểm tra giao diện.

## Lộ trình

1. Khung dự án: repo, công cụ, test, bảng chuỗi hai ngôn ngữ, gói placeholder.
2. Lõi chiến đấu: mô phỏng có seed, bảng khắc 7 hệ, chạy không cần giao diện, có test về tính xác định.
3. Vòng lặp tối thiểu với 1 map placeholder: màn thông tin map, màn nhỏ tự lặp lại, đánh boss, chiêu mộ, lưu game.
4. Tiến trình: level, chỉ số tự nâng, xếp skill, item và bụi, sao, ải phụ, thưởng offline.
5. Pipeline nhập asset MUGEN, rồi nội dung World 1 đủ 12 map.
6. Cân bằng bằng mô phỏng hàng loạt, hoàn thiện giao diện, âm thanh.

Sau v1: World 2 và 3, PvP RTA (server chạy lại mô phỏng từ seed).

Làm theo thứ tự này trừ khi người dùng yêu cầu khác.

## Mặc định tạm thời

Dùng các giá trị này cho tới khi người dùng chốt khác:

- Năm hệ cơ bản khắc nhau theo vòng ngũ hành tương khắc: Kim khắc Mộc, Mộc khắc Thổ, Thổ khắc Thủy, Thủy khắc Hỏa, Hỏa khắc Kim. Người dùng chưa nêu chiều khắc; đây là vòng truyền thống.
- Ánh sáng và Bóng tối đánh nhau thì cả hai chiều đều nhân 2. Hai hệ này không khắc và không bị khắc bởi năm hệ cơ bản.
- Số trong công thức sát thương lấy theo Pokémon: chí mạng nhân 1,5 với tỉ lệ cơ bản 1/24, ngẫu nhiên từ 0,85 đến 1,00, STAB nhân 1,5, skill đánh nhiều mục tiêu nhân 0,75. Kết quả làm tròn xuống, tối thiểu 1.
- Vì công thức lấy theo Pokémon, chỉ số nhân vật nên ở cùng thang với Pokémon: ở level 50, phần lớn chỉ số từ 50 đến 200.
- Hồi chiêu giảm 1 vào cuối mỗi lượt của nhân vật, kể cả lượt bị mất do khống chế. Skill được dùng trong phần mở đầu bắt đầu hồi chiêu ngay sau khi dùng. Hồi chiêu N nghĩa là skill nghỉ đúng N lượt kế tiếp của nhân vật đó: hồi 2 thì dùng ở lượt 1, nghỉ lượt 2 và 3, dùng lại được ở lượt 4.
- Ở màn nhỏ, nhân vật gục thì người kế tiếp vào sân ngay. Người mới vào có thể bị đánh trong vòng đó, nhưng chỉ bắt đầu hành động từ vòng sau.
- Skill có Power 0 không gây sát thương; tác dụng của nó đến từ hiệu ứng trạng thái.
- Hai nhân vật cùng tốc độ thì chọn người đánh trước bằng bộ sinh số có seed.
- Boss có bộ chỉ số riêng khai báo trong dữ liệu map, dưới dạng base stat của bản boss, rồi tính theo cùng công thức chỉ số ở level của boss. Bản chiêu mộ dùng base stat của nhân vật.
- Chỉ số làm tròn xuống sau khi cộng hết các phần.
- Skill có hệ riêng, mặc định bằng hệ của nhân vật.
- Hiệu ứng item theo bậc: Thường 5%, Hiếm 10%, Sử thi 20%, Huyền thoại 30%. Mức 10% và 30% lấy từ ví dụ của người dùng; 5% và 20% là số tạm.
- Mỗi mốc level mở đúng 1 skill, nên mỗi nhân vật có 4 skill.
- Boss dùng bộ skill riêng khai báo trong dữ liệu map, không theo mốc level của người chơi.
- Trong trận boss, boss đánh nhân vật đứng đầu còn sống theo thứ tự đội hình, trừ khi skill ghi khác.
- Ải phụ đánh theo kiểu trận boss, 5 đấu 1.
- Màn nhỏ tự lặp lại cho tới khi người chơi đổi màn hoặc đội thua.
- Đầu mỗi màn nhỏ cả đội hồi đầy máu. Trong một màn, máu giữ nguyên khi chuyển từ lính này sang lính kế tiếp.
- Màn nhỏ giới hạn 100 vòng; quá giới hạn thì tính là thua.
- Skill placeholder: đòn đánh thường Power 40; S1 Power 60, hồi 2 vòng; S2 Power 80, hồi 3 vòng; S3 Power 120; S4 Power 150.
- Hoàn thành một World nghĩa là hạ boss của map cuối lần đầu.
- Mở khóa: map đầu tiên mở sẵn. Các màn nhỏ mở lần lượt. Boss mở khi qua hết màn nhỏ của map. Hạ boss lần đầu mở map kế tiếp, kể cả map đầu của World sau.
- Nhân vật chiêu mộ được gia nhập ở level của boss, không vượt giới hạn level của World đó.
- Seed của mỗi trận lấy từ seed của file lưu trộn với bộ đếm số trận. Seed của file lưu do giao diện tạo khi bắt đầu game mới. Kết quả trận được ghi vào file lưu ngay khi mô phỏng xong; phần phát lại chỉ để xem.
- Mỗi lần hạ boss có 50% rơi item. Bậc rơi theo tỉ lệ 60% Thường, 28% Hiếm, 10% Sử thi, 2% Huyền thoại.
- Mỗi level cho 3 điểm tự nâng. Mỗi chỉ số nhận tối đa số điểm bằng level của nhân vật. Đặt lại tự do.
- Trận boss và ải phụ giới hạn 30 vòng. Ải phụ có 3 lượt mỗi ngày. Thưởng offline tích tối đa 8 giờ.
- Lưu game trên máy người chơi. Dự án phi thương mại.

## Chưa chốt

Không tự quyết các điểm sau. Hỏi người dùng khi công việc chạm tới:

- Danh sách hiệu ứng trạng thái cụ thể. Claude đề xuất hiệu ứng khi soạn skill, người dùng duyệt cùng bộ skill. Đã chốt engine hỗ trợ 4 nhóm: khống chế (choáng, ngủ, câm lặng), sát thương theo vòng (độc, bỏng, chảy máu), tăng giảm chỉ số và hồi chiêu, bảo vệ và hồi phục (khiên, hồi máu theo vòng, miễn trạng thái, khiêu khích).
- Nội dung thay đổi ở từng cấp sao của từng nhân vật. Claude đề xuất cùng bộ skill, người dùng duyệt.
- Mechanic riêng của từng boss. Người dùng sẽ thiết kế sau; hiện tại boss chỉ có skill thường.
