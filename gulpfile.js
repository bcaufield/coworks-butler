var gulp = require('gulp'),
  jade = require('gulp-jade');

gulp.task('default', ['build', 'watch']);

gulp.task('build', ['install-deps', 'templates']);

gulp.task('watch', ['watch-templates']);

gulp.task('templates', function() {
  try {
    gulp.src('./src/*.jade')
      .pipe(jade())
      .pipe(gulp.dest('./pub/'));
  } catch(e) {
    console.log(e.message);
  }
});

gulp.task('watch-templates', function() {
  gulp.watch('./src/*.jade', ['templates'])
    .on('change', function(e) {
      console.log('File ' + e.path + ' was ' + e.type + ', running tasks...');
    });
});

gulp.task('install-deps', function() {
  gulp.src([
    './node_modules/angular-bootstrap/dist/ui-bootstrap-tpls.min.js',
    './node_modules/angular/angular.min.js',
    './node_modules/angular/angular.min.js.map',
    './node_modules/angular-ui-router/release/angular-ui-router.min.js'
  ]).pipe(gulp.dest('./pub/js/'));

  gulp.src('./node_modules/angular-bootstrap/dist/assets/**/*')
    .pipe(gulp.dest('./pub/js/assets'));

  gulp.src([
    './node_modules/angular/angular-csp.css',
    './node_modules/bootstrap/dist/css/bootstrap.min.css',
  ]).pipe(gulp.dest('./pub/css/'));
});