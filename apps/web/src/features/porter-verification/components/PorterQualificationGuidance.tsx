export function PorterQualificationGuidance() {
	return (
		<details className="my-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
			<summary className="cursor-pointer font-bold">
				Căn cứ xác minh năng lực Porter và người dẫn đoàn
			</summary>
			<p className="mt-3">
				Porter hỗ trợ mang đồ và người hành nghề hướng dẫn du lịch có vai trò khác nhau. Duyệt hồ sơ
				trên CTMS là bước kiểm tra nội bộ; quyền dẫn đoàn còn phụ thuộc hoạt động và phạm vi giấy
				tờ.
			</p>
			<ul className="mt-3 list-disc space-y-2 pl-5">
				<li>
					Khi hành nghề hướng dẫn du lịch: kiểm tra thẻ hướng dẫn viên phù hợp, thời hạn, phạm vi
					hành nghề và giấy tờ phân công/hợp đồng theo Điều 58–59 Luật Du lịch 2017. Chứng chỉ
					nghiệp vụ là căn cứ trong hồ sơ cấp thẻ, không thay thế thẻ.
				</li>
				<li>
					Với hoạt động leo núi thể thao: đối chiếu giấy chứng nhận tập huấn chuyên môn với loại
					hoạt động; chương trình tập huấn được Bộ VHTTDL ban hành tại Quyết định 1724/QĐ-BVHTTDL
					năm 2025.
				</li>
				<li>
					Hồ sơ bổ trợ: sơ cấp cứu, cứu hộ, kinh nghiệm tuyến và quy định của đơn vị quản lý địa
					bàn. Chứng nhận sơ cấp cứu hoặc kinh nghiệm địa phương riêng lẻ không chứng minh đủ điều
					kiện hành nghề hướng dẫn du lịch.
				</li>
			</ul>
			<p className="mt-3">
				Admin cần đối chiếu tên người được cấp, đơn vị cấp, số giấy tờ, thời hạn và phạm vi áp dụng
				trước khi duyệt.
			</p>
			<div className="mt-3 flex flex-wrap gap-3 underline">
				<a
					href="https://bvhttdl.gov.vn/Pages/chi-tiet.aspx?url=/quy-dinh-moi-ve-huong-dan-vien-trong-luat-du-lich-2017-619207.htm"
					target="_blank"
					rel="noreferrer"
				>
					Bộ VHTTDL: điều kiện hướng dẫn viên
				</a>
				<a
					href="https://bvhttdl.gov.vn/trien-khai-chuong-trinh-tap-huan-chuyen-mon-the-thao-doi-voi-nguoi-huong-dan-tap-luyen-mon-leo-nui-the-thao-20250607105842503.htm"
					target="_blank"
					rel="noreferrer"
				>
					Chương trình tập huấn leo núi thể thao
				</a>
			</div>
		</details>
	);
}
