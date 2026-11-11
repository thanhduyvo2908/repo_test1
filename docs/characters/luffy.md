# Luffy

Bản thiết kế nhân vật. Luật chung ở `CLAUDE.md`, bối cảnh World 1 ở `docs/world-1.md`.

Nhãn **Đề xuất** đánh dấu phần chưa được người dùng duyệt. Mục ghi "Chờ người dùng" thì người dùng thiết kế; không tự điền.

## Tổng quan

| Mục | Giá trị |
| --- | --- |
| Tên (EN / VI) | Luffy / Luffy |
| Nguồn | Nhân vật khởi đầu |
| Hệ | Thổ (`earth`) |
| Loại sát thương | Vật lý |
| Item | Straw Hat / Mũ rơm |
| Sprite | Có: JUS gốc, Gigant Battle |
| Mốc lên 2 sao | **Đề xuất:** hạ boss map 12 (Don Krieg) |

Chất nhân vật: chờ người dùng. Ví dụ: tấn công thuần, đấu sĩ trâu bò, hay đánh nhanh.

## Ràng buộc từ thiết kế World 1

- Người chơi có thể chỉ có Luffy trong nhiều map đầu. Zoro (map 2) chỉ có 10% chiêu mộ, Alvida (map 1) có 20%. Luffy phải tự đánh được trận boss của map 1 đến 3, dù trận boss là 5 đấu 1 và trong đội có thể chỉ có mình Luffy. Vì vậy Luffy cần tự trụ được, không chỉ có sát thương.
- Luffy chỉ có S1 cho tới level 20 (khoảng map 8), nên S1 và đòn đánh thường gánh gần hết World 1.
- Usopp (Mộc, map 7) khắc Luffy: Usopp đánh Luffy nhân 2, Luffy đánh Usopp nhân 0,5.
- Mũ rơm tăng sát thương vật lý cho skill hệ Thổ. Nếu Luffy có skill khác hệ, skill đó không hưởng Mũ rơm và không có STAB.

## Base stat

**Đề xuất**, tổng 460. Lý do: Luffy là nhân vật khởi đầu, phải gánh đội một mình ở mấy map đầu, nên chỉ số đều. Công vật lý cao nhất vì đánh vật lý. HP khá vì thân cao su chịu đòn tốt. Công phép thấp vì không dùng tới.

| HP | Công vật lý | Thủ vật lý | Công phép | Thủ phép | Tốc độ | Tổng |
| --- | --- | --- | --- | --- | --- | --- |
| 90 | 100 | 75 | 40 | 70 | 85 | 460 |

Chỉ số thực tế, chưa cộng điểm tự nâng:

| Level | HP | Công vật lý | Thủ vật lý | Công phép | Thủ phép | Tốc độ |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 12 | 7 | 6 | 5 | 6 | 6 |
| 10 | 38 | 25 | 20 | 13 | 19 | 22 |
| 20 | 66 | 45 | 35 | 21 | 33 | 39 |
| 30 | 94 | 65 | 50 | 29 | 47 | 56 |

## Passive

Chờ người dùng.

## Đòn đánh thường

Chờ người dùng: tên, Power, chỉ số tăng theo.

## Skill

Mỗi skill cần: tên EN và VI, mô tả EN và VI, hệ (mặc định Thổ), Power, chỉ số tăng theo kèm trọng số, mục tiêu, hồi chiêu (chỉ S1 và S2), hiệu ứng trạng thái kèm tỉ lệ và số vòng.

| Ô | Mở ở level | Kiểu dùng | Thiết kế |
| --- | --- | --- | --- |
| S1 | 1 | Có hồi chiêu | Chờ người dùng |
| S2 | 20 | Có hồi chiêu | Chờ người dùng |
| S3 | 30 | 1 lần mỗi trận | Chờ người dùng |
| S4 | 50 | 1 lần mỗi trận | Thuộc World sau |

## Lên 2 sao

Chờ người dùng: base stat cộng thêm, skill thay đổi, hiệu ứng thêm.

## Item: Mũ rơm

- Điều kiện: skill hệ Thổ, sát thương vật lý.
- Hiệu ứng: tăng sát thương. Thường 5%, Hiếm 10%, Sử thi 20%, Huyền thoại 30%.
- Không rơi từ boss. Người chơi nhận bản Huyền thoại khi hạ Don Krieg lần đầu.

## Tư liệu: chiêu của Luffy ở East Blue

Chỉ để tham khảo khi đặt tên và chọn hoạt ảnh. Không phải thiết kế skill.

Gomu Gomu no Pistol, Whip, Rocket, Bazooka, Gatling, Balloon (Fusen), Stamp, Spear, Axe. Thân cao su miễn nhiễm đòn đánh cùn và đạn.
