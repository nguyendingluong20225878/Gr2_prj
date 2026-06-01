### Logic Công Thức Cốt Lõi

#### 1. Điểm Hướng FinBERT

Công thức:

`directionScore = pPos - pNeg`

Biến số:

- `pPos`: xác suất FinBERT gán nhãn văn bản là tích cực/bullish.
- `pNeg`: xác suất FinBERT gán nhãn văn bản là tiêu cực/bearish.
- `pNeu`: xác suất FinBERT gán nhãn văn bản là trung lập.

Ý nghĩa:

Văn bản tích cực đẩy điểm về +1; văn bản tiêu cực đẩy về -1. Văn bản trung lập chỉ ảnh hưởng đến entropy, không ảnh hưởng trực tiếp đến hướng. Điều này hợp lý vì hướng giao dịch cần sự phân cực, còn sự không chắc chắn cần metadata về độ tin cậy/rủi ro.

Cơ sở:

- Dựa trên kỳ vọng toán học của một biến ngẫu nhiên rời rạc có ba trạng thái: Pos, Neg, Neu.
- Gán giá trị Pos = `+1`, Neg = `-1`, Neu = `0`.

Công thức kỳ vọng:

`E[direction] = 1 * pPos + (-1) * pNeg + 0 * pNeu = pPos - pNeg`

Vì vậy `directionScore` là điểm kỳ vọng hướng thị trường từ phân phối xác suất của FinBERT.


#### 2. Entropy Chuẩn Hóa

Công thức:

`entropy = -(pPos ln pPos + pNeg ln pNeg + pNeu ln pNeu) / ln(3)`

Biến số:

- Ba xác suất được kẹp với `1e-9` để tránh `ln(0)`.
- `ln(3)` chuẩn hóa entropy về khoảng `[0, 1]` cho ba lớp.

Ý nghĩa:

Entropy thấp nghĩa là mô hình quyết đoán. Entropy cao nghĩa là xác suất phân tán đều. 
Về nghiệp vụ: entropy cao nên giảm độ tin cậy hoặc kích hoạt kiểm tra lại. Hiện tại lưu entropy trung bình dưới tên `volatilityFlag`.

Cơ sở:

- Dựa trên Shannon Entropy trong lý thuyết thông tin.
- Entropy đo độ bất định của một phân phối xác suất.

Công thức Shannon Entropy:

`H(p) = -sum(p_i * ln(p_i))`

Với ba lớp sentiment:

`H = -(pPos ln pPos + pNeg ln pNeg + pNeu ln pNeu)`

Chuẩn hóa:

`entropy = H / ln(3)`

Lý do chia cho `ln(3)`:

- Entropy lớn nhất xảy ra khi ba lớp đều nhau: `pPos = pNeg = pNeu = 1/3`.
- Khi đó `H_max = ln(3)`.
- Chia cho `ln(3)` đưa entropy về khoảng `[0, 1]`.

Ý nghĩa nghiệp vụ:

- Gần `0`: mô hình rất chắc về một nhãn.
- Gần `1`: mô hình phân vân cao, tín hiệu nên bị xem là rủi ro hơn.

#### 3. Suy Giảm Theo Thời Gian (Time Decay)

Công thức:

`decay = exp(-(ln 2 / halfLifeHours) * hoursOld)`

Biến số:

- `hoursOld`: độ “cũ” của nội dung .
- `halfLifeHours`: `tweetHalfLifeHours` hoặc `newsHalfLifeHours`.

Ý nghĩa:

Bằng chứng mất đi một nửa trọng số sau mỗi chu kỳ bán rã. 

Cơ sở:

- Dựa trên hàm suy giảm mũ, thường dùng trong vật lý phóng xạ, tài chính định lượng, và mô hình hóa freshness/recency.
- Half-life nghĩa là sau một khoảng thời gian cố định, trọng số còn một nửa.

Công thức tổng quát:

`decay(t) = exp(-lambda * t)`

Điều kiện half-life:

`decay(halfLife) = 1/2`

Suy ra:

`exp(-lambda * halfLife) = 1/2`

`lambda = ln(2) / halfLife`

Thế vào:

`decay = exp(-(ln(2) / halfLifeHours) * hoursOld)`

Ý nghĩa nghiệp vụ:

- Bằng chứng mới có trọng số cao.
- Bằng chứng cũ mất dần ảnh hưởng nhưng không rơi về 0 đột ngột.

#### 4. Trọng Số Gốc Tweet

Công thức:

`rawWeight = authorWeight * (1 + ln(1 + replyCount + retweetCount + likeCount))`

Sau đó:

`finalWeight = min(rawWeight * decay, remainingUserWeightCap)`

Biến số:

- Tương tác là tổng số trả lời, retweet, like.
- `authorWeight`: hệ số nhân dựa trên số follower/danh tiếng
- `maxWeightPerUser`: giới hạn tổng trọng số mỗi tác giả.

Ý nghĩa:

Tương tác làm tăng trọng số bằng chứng nhưng logarit ngăn không cho một bài viral chi phối tuyến tính. Giới hạn người dùng giảm spam từ một tài khoản.

Cơ sở:

- Dựa trên phép biến đổi logarit để xử lý dữ liệu lệch phải/đuôi dài.
- Engagement trên mạng xã hội thường có phân phối power-law: một số ít bài rất viral, phần lớn bài rất nhỏ.

Công thức:

`engagementMultiplier = 1 + ln(1 + engagement)`

Lý do dùng `ln(1 + x)`:

- `+1` giúp xử lý engagement = 0.
- Log làm giảm ảnh hưởng tuyến tính của outlier.
- Một tweet 10,000 likes không nên tự động mạnh gấp 100 lần tweet 100 likes.

Ý nghĩa nghiệp vụ:

- Viral tweet vẫn quan trọng hơn tweet nhỏ.
- Nhưng hệ thống không để một bài viral đơn lẻ chi phối toàn bộ score.

#### 5. Trọng Số Gốc Tin Tức

Công thức:

`rawWeight = newsBaseWeight * siteWeight`

`finalWeight = newsBaseWeight * siteWeight * decay`

Ý nghĩa:

`siteWeight` lấy theo host bài báo, đang là 1. 
Điều này cho phép kiểm thử lại/độ tin cậy nguồn ảnh hưởng đến tín hiệu tương lai mà không hardcode độ tin cậy nguồn.


#### 6. Trung Bình Trọng Số Theo Token

Công thức:

`weightedBase(token) = sum(directionScore_i * finalWeight_i) / sum(finalWeight_i)`

Biến số:

- `i`: các tài liệu được chấm điểm đề cập đến token.
- `finalWeight_i`: trọng số bằng chứng đã điều chỉnh suy giảm/tham gia nguồn.

Ý nghĩa:

Đây là trung bình trọng số hướng cảm xúc cho token.

Cơ sở:

- Dựa trên trung bình trọng số trong thống kê.
- Mỗi tài liệu là một quan sát, `finalWeight` là độ tin cậy/độ quan trọng của quan sát đó.

Công thức:

`weightedBase = sum(score_i * weight_i) / sum(weight_i)`

Ý nghĩa:

- Quan sát có nguồn mạnh, mới hơn, hoặc engagement cao hơn sẽ đóng góp nhiều hơn.
- Đây là estimator hợp lý khi mỗi quan sát có độ tin cậy khác nhau.




#### 7. Tăng Cường Khối Lượng & Hợp Nhất Raw

Công thức:

`medianMarketWeight = median(totalWeight_per_token)`

`marketNormFactor = max(ln(1 + medianMarketWeight), 0.1)`

`volumeBoost = ln(1 + totalWeight_token) / marketNormFactor`

`unifiedRaw = weightedBase * (1 + volumeBoost)`

Ý nghĩa:

Nếu nhiều tài liệu trọng số đề cập đến token, tín hiệu mạnh hơn. Chuẩn hóa theo median thị trường ngăn khối lượng raw bị hiểu sai khi không có ngữ cảnh.

Median → mức bình thường của thị trường,
VolumeBoost → token này hot hơn mức đó bao nhiêu ,
UnifiedRaw → cảm xúc × độ hot


Cơ sở:

- Median là thống kê bền vững, ít bị outlier ảnh hưởng hơn mean.
- Log volume boost dựa trên ý tưởng diminishing returns: thêm bằng chứng giúp tăng độ mạnh tín hiệu, nhưng mức tăng giảm dần.

Công thức:

`volumeBoost = ln(1 + totalWeight_token) / max(ln(1 + medianMarketWeight), 0.1)`

Ý nghĩa:

- Token được nhiều nguồn độc lập nhắc đến sẽ được tăng score.
- Chuẩn hóa bằng median giúp so với mặt bằng chung của batch hiện tại.
- `max(..., 0.1)` là floor kỹ thuật để tránh chia cho số quá nhỏ.



#### 8. Z Thời Gian Bền Vững (Robust Time Z)

Công thức cho token có lịch sử >= 3:

`safeMad = max(MAD(history.unifiedRaw) * 1.4826, 0.01)`

`timeZ = (unifiedRaw_current - EMA_7(history.unifiedRaw)) / safeMad`

Ý nghĩa:

Đo mức độ bất thường của tín hiệu hiện tại so với lịch sử gần đây. `MAD * 1.4826` xấp xỉ độ lệch chuẩn nhưng bền vững với ngoại lệ. Hiện tại dùng EMA thay vì giá trị raw trước đó.

TimeZ = mức “bất thường” của tín hiệu hiện tại so với chính quá khứ của nó
(Hiện tại – Bình thường) / Độ dao động bình thường
Cơ sở:

- Dựa trên Z-score trong thống kê: đo một giá trị lệch bao nhiêu độ lệch chuẩn so với trung tâm.
- Thay vì dùng mean/std thường, hệ thống dùng EMA và MAD để bền vững hơn với outlier.

Z-score cổ điển:

`z = (x - mean) / std`

Phiên bản robust đang dùng:

`timeZ = (unifiedRaw_current - EMA_7(history)) / max(MAD(history) * 1.4826, 0.01)`

Vì sao `MAD * 1.4826`:

- MAD là median absolute deviation (độ lệch tuyệt đối trung vị).
- Với phân phối chuẩn, `MAD * 1.4826` xấp xỉ độ lệch chuẩn.
- Hệ số `1.4826` đến từ quan hệ giữa MAD và sigma của phân phối chuẩn.

Vì sao dùng EMA:

- EMA là exponential moving average (Trung bình động có trọng số giảm dần theo thời gian).
- EMA phản ứng với dữ liệu mới nhanh hơn simple moving average.
- Phù hợp với thị trường crypto vì regime thay đổi nhanh.


#### 9. Trung Hòa Beta BTC

Công thức:

Với BTC:

`pureAlphaZ_BTC = timeZ_BTC`

Với non-BTC:

`pureAlphaZ_token = timeZ_token - betaToBtc * btcTimeZ`

Biến số:

- `betaToBtc`: hiện tại: `0.75`.
- `btcTimeZ`: cú sốc thị trường đại diện.

Ý nghĩa:

Nếu toàn thị trường crypto biến động do BTC, tín hiệu altcoin nên bị giảm trọng số. Mục tiêu là tách biệt alpha riêng của token.


Cơ sở:

- Dựa trên ý tưởng market model trong tài chính định lượng.
- Lợi nhuận/tín hiệu của tài sản có thể tách thành phần thị trường chung và phần alpha riêng.

Market model đơn giản:

`asset_signal = alpha + beta * market_signal + noise`

Suy ra alpha riêng:

`alpha ~= asset_signal - beta * market_signal`

Trong code:

`pureAlphaZ_token = timeZ_token - betaToBtc * btcTimeZ`

Ý nghĩa:

- BTC được dùng như proxy cho thị trường crypto chung.
- Nếu altcoin tăng chỉ vì cả thị trường tăng theo BTC, điểm alpha riêng bị giảm.
- Nếu altcoin mạnh hơn thị trường chung, `pureAlphaZ` vẫn cao.



#### 10. Z Chéo (Cross-Sectional Z)

Công thức:

`crossMean = mean(pureAlphaZ của các token non-BTC có >=3 điểm lịch sử)`

`crossStd = max(std(pureAlphaZ), 0.05)`

`crossZ = (pureAlphaZ - crossMean) / crossStd`

Ý nghĩa:

So sánh token với toàn bộ thị trường tại cùng thời điểm. Trả lời: “Token này mạnh/yếu bất thường so với các đồng khác?”

Cơ sở:

- Dựa trên cross-sectional standardization trong factor investing.
- So sánh token với các token khác tại cùng thời điểm.

Công thức:

`crossZ = (pureAlphaZ - crossMean) / crossStd`

Ý nghĩa:

- `timeZ` trả lời: token này bất thường so với chính lịch sử của nó không?
- `crossZ` trả lời: token này bất thường so với các token khác trong cùng batch không?

#### 11. Điểm Số Cuối Cùng (Final Score)

Công thức:

Nếu số lượng cross-section hợp lệ >= 3:

`finalScore = alphaBlend * pureAlphaZ + (1 - alphaBlend) * crossZ`

Ngược lại:

`finalScore = pureAlphaZ`

Biến số:

- `alphaBlend`: hiện tại `0.7`.

Ý nghĩa:

70% alpha tự thân, 30% alpha so với đồng khác. Ưu tiên bất ngờ lịch sử riêng token nhưng vẫn xét cơ hội tương đối.

Cơ sở:

- Dựa trên convex combination, tức tổ hợp tuyến tính có trọng số.

Công thức:

`finalScore = alphaBlend * pureAlphaZ + (1 - alphaBlend) * crossZ`

Với `alphaBlend = 0.7`:

- 70% dựa vào alpha lịch sử riêng của token.
- 30% dựa vào sức mạnh tương đối so với thị trường ngang hàng.

Ý nghĩa:

- Tránh chỉ nhìn một chiều.
- Token vừa mạnh so với chính nó, vừa nổi bật so với thị trường sẽ có score tốt hơn.

#### 12. Tín Hiệu/Hành Động/Độ Tin Cậy

Điều kiện tín hiệu:

`abs(finalScore) > signalThreshold`

Hành động:

- `buy` nếu `finalScore > actionThreshold`
- `sell` nếu `finalScore < -actionThreshold`
- ngược lại `hold`

Độ tin cậy:

Khởi động lạnh (cold start):

`confidence = min(abs(finalScore) / coldStartConfidenceDivisor, 0.4)`

Bảo vệ hành động cold-start:

`actionThreshold = coldStartActionThreshold`

Mặc định `coldStartActionThreshold = 999`, nên tín hiệu cold-start chỉ xuất hiện dạng watch/hold, không tự động BUY/SELL.

Bình thường:

`confidence = min(abs(finalScore) / confidenceDivisor, 0.95) * sampleSizePenalty`

Ý nghĩa:

Độ tin cậy tỷ lệ với độ lớn điểm số nhưng giới hạn token mới ở 40%. Đây là rào chắn hợp lý để tránh hành động quá mạnh với token chưa xác thực.

Cơ sở:

- Dựa trên rule-based statistical decision.
- Chỉ hành động khi độ lệch vượt một ngưỡng đủ lớn để tránh nhiễu.

Điều kiện:

`abs(finalScore) > signalThreshold`

Hành động:

- `buy` nếu `finalScore > actionThreshold`
- `sell` nếu `finalScore < -actionThreshold`
- `hold` nếu chưa vượt ngưỡng hành động

Ý nghĩa:

- `signalThreshold` lọc tín hiệu yếu.
- `actionThreshold` quyết định khi nào đủ mạnh để đưa ra hướng giao dịch.
- Cold-start dùng ngưỡng hành động rất cao để tránh BUY/SELL khi thiếu lịch sử.


Cơ sở:

- Dựa trên monotonic score calibration đơn giản.
- Score càng lớn thì confidence càng cao, nhưng bị cap để tránh quá tự tin.

Công thức:

`confidence = min(abs(finalScore) / confidenceDivisor, 0.95) * sampleSizePenalty`

Cold-start:

`confidence = min(abs(finalScore) / coldStartConfidenceDivisor, 0.4)`

Ý nghĩa:

- Không cho confidence vượt 95% ở chế độ bình thường.
- Không cho token mới vượt 40%.
- `sampleSizePenalty` là shrinkage heuristic: ít dữ liệu thì kéo confidence xuống.

---

