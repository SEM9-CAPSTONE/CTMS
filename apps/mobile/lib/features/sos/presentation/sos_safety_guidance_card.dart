import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';

class SosSafetyGuidanceCard extends StatelessWidget {
  const SosSafetyGuidanceCard({
    super.key,
    required this.emergencyType,
  });

  final String emergencyType;

  (String, List<String>) _guidanceForType(String type) => switch (type) {
        'medical' => (
            'Hướng dẫn sơ cứu y tế khẩn cấp',
            [
              'Kiểm tra nhịp thở và tri giác của người bị nạn (nguyên tắc hô hấp & tuần hoàn).',
              'Nếu bất tỉnh nhưng còn thở: đặt nằm nghiêng an toàn (tư thế hồi sức) để tránh ngạt đường thở.',
              'Giữ ấm cơ thể, nới lỏng trang phục, tuyệt đối không cho ăn uống khi chưa tỉnh táo.',
              'Theo dõi sát tình trạng sức khoẻ và nhịp tim định kỳ mỗi 5 phút.',
            ]
          ),
        'injury' => (
            'Xử lý chấn thương & cố định thương tích',
            [
              'Dùng băng ép hoặc vải sạch băng chặt vị trí chảy máu để cầm máu tức thì.',
              'Cố định chi bị thương bằng nẹp tạm thời (gậy leo núi, cành cây chắc chắn).',
              'Nâng cao vùng tổn thương cao hơn ngực để giảm sưng nề và hạn chế xuất huyết.',
              'Tuyệt đối không di chuyển người bệnh nếu nghi ngờ có chấn thương cột sống hoặc cổ.',
            ]
          ),
        'lost' => (
            'Nguyên tắc sinh tồn khi lạc đường',
            [
              'Áp dụng quy tắc DỪNG LẠI: Bình tĩnh quan sát, không tiếp tục đi sâu vào rừng.',
              'Ở yên tại vị trí khô ráo, bằng phẳng và có tầm nhìn thoáng từ trên cao.',
              'Thổi còi cứu hộ 3 tiếng ngắt quãng định kỳ để lực lượng tìm kiếm dễ phát hiện.',
              'Tiết kiệm nguồn nước, chuẩn bị giữ ấm và tuyệt đối không di chuyển trong đêm.',
            ]
          ),
        'natural_hazard' => (
            'Phòng tránh thiên tai, sạt lở & lũ quét',
            [
              'Khẩn trương di chuyển lên vị trí đất cao, tránh xa chân vách núi và lòng suối cạn.',
              'Quan sát hiện tượng nước suối đổi màu đục hoặc tiếng rung lớn từ thượng nguồn.',
              'Tránh xa cây cao cô lập hoặc vật kim loại khi xuất hiện mưa giông sấm sét.',
              'Kiểm tra độ vững chắc của mặt đất trước khi bước tiếp, tránh vùng đất bùn sụt lún.',
            ]
          ),
        _ => (
            'Chỉ dẫn an toàn ngoại tuyến tức thì',
            [
              'Giữ bình tĩnh, hít thở sâu để đánh giá chính xác mức độ an toàn của khu vực hiện tại.',
              'Bật chế độ tiết kiệm pin trên điện thoại, giảm độ sáng màn hình để duy trì nguồn điện.',
              'Tìm vị trí trú ẩn kín gió, tránh các mối nguy tự nhiên hoặc động vật hoang dã.',
              'Chuẩn bị sẵn còi cứu hộ, đèn pin hoặc vật phát sáng để báo hiệu khi có đội cứu trợ.',
            ]
          ),
      };

  @override
  Widget build(BuildContext context) {
    final (title, steps) = _guidanceForType(emergencyType);

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.lg),
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.cardBorderRadius,
        border: Border.all(color: AppColors.border, width: 1.0),
        boxShadow: AppColors.cardShadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.brandLight,
                  borderRadius: AppRadius.controlBorderRadius,
                ),
                child: const Icon(
                  Icons.health_and_safety_outlined,
                  color: AppColors.brandPrimary,
                  size: 20,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppTypography.bodyStrong.copyWith(
                        fontWeight: FontWeight.w800,
                        color: Colors.black,
                      ),
                    ),
                    Text(
                      'Chỉ dẫn tại chỗ (Khả dụng ngay khi mất mạng)',
                      style: AppTypography.caption.copyWith(
                        color: Colors.black54,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          const Divider(height: 1, thickness: 1, color: AppColors.border),
          const SizedBox(height: AppSpacing.md),
          ...steps.asMap().entries.map((entry) {
            final idx = entry.key + 1;
            final text = entry.value;
            return Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 20,
                    height: 20,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppColors.brandLight,
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      '$idx',
                      style: AppTypography.caption.copyWith(
                        color: AppColors.brandPrimary,
                        fontWeight: FontWeight.w700,
                        fontSize: 11,
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      text,
                      style: AppTypography.caption.copyWith(
                        color: Colors.black87,
                        fontSize: 13,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
