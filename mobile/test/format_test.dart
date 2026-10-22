import 'package:flutter_test/flutter_test.dart';
import 'package:lapor_bhabin/core/forms/form_schema.dart';

void main() {
  test('ageYears menghitung umur penuh dan menolak format salah', () {
    final now = DateTime.now();
    expect(ageYears('${now.year - 3}-01-01'), anyOf(2, 3));
    expect(ageYears('bukan-tanggal'), isNull);
    expect(ageYears(null), isNull);
  });

  test('showIf: balita & perempuan 10–49 tahun', () {
    final balita = ShowIf.fromJson({'dob': 'tanggal_lahir', 'ageMax': 5});
    final ibu = ShowIf.fromJson({'sexField': 'jk', 'sex': 'Perempuan', 'dob': 'tanggal_lahir', 'ageMin': 10, 'ageMax': 50});
    final y = DateTime.now().year;
    expect(balita.met({'tanggal_lahir': '${y - 2}-01-01'}), isTrue);
    expect(balita.met({'tanggal_lahir': '${y - 9}-01-01'}), isFalse);
    expect(ibu.met({'jk': 'Perempuan', 'tanggal_lahir': '${y - 30}-01-01'}), isTrue);
    expect(ibu.met({'jk': 'Laki-laki', 'tanggal_lahir': '${y - 30}-01-01'}), isFalse);
  });
}
